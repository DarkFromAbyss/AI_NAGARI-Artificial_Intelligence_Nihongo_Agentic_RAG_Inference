# AI NARAGI - System Description Registry

**Last Updated:** May 14, 2026  
**Version:** 1.3.0 (VRM Character Animation - Eye-Blinking)

---

## 📋 Registry Overview

This document serves as the **single source of truth** for all system components, functions, and modules in AI NARAGI. Every component created or modified during TTS integration is documented here with:
- **Name:** Technical identifier
- **Internal Dependencies:** Libraries and modules used
- **Purpose:** Problem solved
- **Process Flow:** Step-by-step logic description

---

## 🧠 TIER 1: LLM Core - Tag Parsing & Output Formatting

### Component 1: TagExtractor (llm_core/utils/tag_extractor.py)

**Name:** `TagExtractor` class + `ExtractedTags` dataclass

**Internal Dependencies:**
- `re` (Python standard library for regex)
- `llm_core.utils.logger` (centralized logging)

**Purpose:** Extracts XML tags (`<display>`, `<html>`, `<voice>`, `<intent>`) from LLM dual-track output with robust error handling

**Process Flow:**
1. Accept raw LLM output string
2. Apply regex patterns to search for each tag: `<tag>(.*?)</tag>`
3. Extract matched content and strip whitespace
4. Validate intent tag (must be "other" or "search")
5. If any tag missing, use fallback values (per FALLBACK_VALUES dict)
6. Return `ExtractedTags` dataclass with success flag and error message
7. Log all extraction operations with DEBUG/WARNING/ERROR levels

**Key Methods:**
- `extract_tags(llm_output)` - Full tag extraction with fallbacks
- `extract_voice_only(llm_output)` - Optimized extraction of voice tag only
- `validate_xml_structure(text)` - Checks if all required tags present
- `sanitize_voice_text(text)` - Cleans text for TTS compatibility

**Error Handling:** Invalid inputs, missing tags, malformed XML → fallback values + WARNING log

---

### Component 2: OutputFormatter (llm_core/output_formatter.py)

**Name:** `OutputFormatter` class + `FormattedResponse` dataclass

**Internal Dependencies:**
- `llm_core.utils.tag_extractor.TagExtractor` (for XML parsing)
- `llm_core.utils.logger` (logging)

**Purpose:** Formats and validates LLM output into standardized response structure for downstream processing

**Process Flow:**
1. Accept raw LLM output
2. Call `TagExtractor.extract_tags()` to parse XML
3. Validate extraction success
4. Sanitize voice text using `TagExtractor.sanitize_voice_text()`
5. Build metadata dictionary (extraction stats)
6. Return `FormattedResponse` with all components or error details
7. Log formatting results with context

**Key Methods:**
- `format_response(llm_output)` - Main formatting pipeline
- `validate_xml_tags(text)` - Structural validation
- `get_response_summary(response)` - Log-friendly summary
- `_create_error_response(raw_output, error_msg)` - Fallback creation

**Error Handling:** Empty output, extraction failures → error response with fallback values

---

### Component 3: Enhanced SystemPromptManager (llm_core/prompts/system_prompts.py)

**Name:** `SystemPromptManager.get_system_prompt()` method (updated)

**Internal Dependencies:**
- `llm_core.utils.data_loaders.load_markdown_file()` (file loading)
- `llm_core.utils.logger` (logging)

**Purpose:** Assemble complete system prompt with explicit dual-track XML output enforcer

**Process Flow:**
1. Load INTRO, CONTEXT, RULES from brain/ markdown files
2. Build XML_OUTPUT_ENFORCER section with:
   - Exact XML tag structure (html, display, voice, intent)
   - Language-specific instructions for display_lang parameter
   - TTS-specific guidance for voice text (Hiragana/Katakana for clarity)
   - Fallback instructions for error cases
3. Inject language setting and timestamp into template
4. Return complete system prompt as string
5. Log prompt stats (character counts)

**Critical Instructions in Enforcer:**
- MUST output ONLY four XML tags (NO other text)
- `<voice>` MUST be natural Japanese (never mixed languages)
- `<display>` MUST be in specified language (en/vi/ja)
- `<intent>` MUST be ONLY "other" or "search"

**Error Handling:** Missing markdown files → fallback content

---

### Component 4: New Pydantic Schemas (llm_core/schemas.py)

**Name:** `TTSVoiceExtractionSchema`, `FormattedLLMResponseSchema` (new classes)

**Internal Dependencies:**
- `pydantic.BaseModel, Field, field_validator` (validation framework)

**Purpose:** Provide strict type contracts for TTS voice text passing and formatted response validation

**Process Flow:**

**TTSVoiceExtractionSchema:**
1. Validate voice_text (1-5000 chars, non-empty after strip)
2. Validate speaker_id (0-100, default 1)
3. Optional session_id for tracking
4. Enforce schema at system boundaries

**FormattedLLMResponseSchema:**
1. Validate success boolean
2. Validate all text fields (display, html, voice, intent)
3. Intent must be "other" or "search"
4. Optional metadata and error details
5. Return structured response for downstream processing

**Error Handling:** Invalid inputs → 422 validation error before reaching business logic

---

## 🔊 TIER 2: Backend - TTS Engine & Streaming

### Component 5: VoicevoxTTSService (backend/tts/voicevox_service.py)

**Name:** `VoicevoxTTSService` class + `TTSAudioOutput` dataclass + `ensure_executable_permissions()` helper

**Internal Dependencies:**
- `subprocess` (manage Voicevox engine process)
- `requests` (HTTP API calls to Voicevox)
- `backend.core.logger` (logging)
- `pathlib.Path` (file path handling)
- `stat` (Unix file permissions on Windows)
- `time` (startup synchronization)

**Purpose:** Manage Voicevox subprocess lifecycle with permission verification and robust initialization

**Process Flow:**

**ensure_executable_permissions(exe_path):**
1. Check if executable exists at path
2. Verify X_OK (execute) permission using `os.access()`
3. If permission missing, attempt to grant via `stat.S_IXUSR | S_IXGRP | S_IXOTH`
4. Log permission changes and handle PermissionError gracefully
5. Return True if accessible, False otherwise

**start_engine():**
1. Check if already running, return True if yes
2. Verify Voicevox executable exists at configured path
3. **[NEW]** Call `ensure_executable_permissions()` - CRITICAL pre-check
4. If permission denied, log error and return False
5. Start subprocess with stdout/stderr pipes and CREATE_NO_WINDOW flag
6. Wait 0.5s then verify process didn't crash immediately using `poll()`
7. If process already exited, capture stderr and log error output
8. Set engine_start_time and wait ENGINE_INITIAL_WAIT (2.0s) for Windows startup overhead
9. Poll health endpoint every 0.5s with remaining timeout
10. On readiness: set `is_ready=True`, log total startup time, return True
11. On timeout/failure: call `_stop_engine()` and return False

**synthesize(text, speaker_id=1):**
1. Validate text input (non-empty, string type)
2. Ensure engine is ready (start if not)
3. POST to `/audio_query` with text and speaker_id (10s timeout)
4. If 200 OK, receive audio query JSON
5. POST to `/synthesis` with query data and speaker_id (10s timeout)
6. Receive WAV audio bytes
7. Parse WAV metadata (sample_rate, channels, duration) from binary header
8. Build `TTSAudioOutput` dataclass with audio and metadata
9. If auto_play enabled, queue async playback in background thread
10. Return audio output and None (no error)

**health_check():**
1. GET `/version` endpoint with 1s timeout
2. Return True if 200 OK, False on exception

**_wait_for_readiness(timeout):**
1. Loop until timeout elapsed
2. Call health_check() each iteration
3. Sleep 0.5s between attempts
4. On success, log attempt count and elapsed time
5. On timeout, check if process crashed using `poll()` and log accordingly
6. Return boolean readiness status

**_stop_engine():**
1. Return True if no process running
2. Check if process still active using `poll()`
3. If running: call `terminate()` with 5s timeout
4. If terminate times out: call `kill()` with 2s timeout
5. Set `is_ready=False` and log status
6. Handle exceptions gracefully

**_cleanup_process():**
1. **[NEW]** Attempt to terminate process without blocking
2. Set engine_process to None and is_ready to False
3. Used in exception handlers to ensure clean state

**Error Handling:** 
- Permission denied → return False immediately with ERROR log
- Process crash → detect via poll() return code, log stderr, return False
- Engine timeout → retry with longer timeout or raise HTTPException
- Network error → set `is_ready=False`, return error to client

**Key Parameters:**
- `ENGINE_INITIAL_WAIT = 2.0` - Wait before polling (accounts for DirectML initialization)
- `ENGINE_STARTUP_MAX_RETRIES = 30` - Max polling attempts (15 seconds at 0.5s intervals)
- `VOICEVOX_TIMEOUT = 10` - HTTP request timeout for synthesis calls
- `VOICEVOX_PORT = 50021` - Default Voicevox API port

---

### Component 6: TTS Router (backend/routers/tts.py)

**Name:** `POST /api/tts/synthesize` endpoint + `GET /api/tts/health` endpoint

**Internal Dependencies:**
- `fastapi.APIRouter, StreamingResponse, HTTPException` (API framework)
- `backend.tts.voicevox_service.VoicevoxTTSService` (TTS engine)
- `backend.core.logger` (logging)

**Purpose:** Expose TTS synthesis as REST API with streaming audio response

**Process Flow:**

**/api/tts/synthesize (POST):**
1. Validate request: `TTSSynthesisRequest` (text, speaker_id, session_id)
2. Extract and trim text
3. Get TTS service from app.state
4. Call `service.synthesize(text, speaker_id)`
5. If error, return 503 Service Unavailable with error detail
6. Return `StreamingResponse` with:
   - Media type: "audio/wav"
   - Headers: X-Audio-Duration, X-Synthesis-Time, Cache-Control
   - Body: audio bytes
7. Log: session_id, text_length, speaker_id, timing metrics

**/api/tts/health (GET):**
1. Get TTS service from app.state
2. Call `service.health_check()`
3. Return JSON: `{status, engine_ready, engine_started}`
4. Log health check result

**Error Handling:** 400 validation error, 503 service unavailable, 500 unexpected error

---

### Component 7: Extended Chat Router (backend/routers/chat.py - updated)

**Name:** `POST /api/chat` endpoint (updated) + new ResponseSchema

**Internal Dependencies:**
- `llm_core.output_formatter.OutputFormatter` (new tag extraction)
- `backend.schemas.chat_schema.ChatMessageResponse` (updated schema)

**Purpose:** Extract both display and voice text from LLM output for dual delivery

**Process Flow (New Steps 4-5):**
1. ✅ Original: Generate message_id, log request, invoke agent
2. ✅ Original: Receive LLM output
3. **NEW:** Call `OutputFormatter.format_response(llm_output.assistant_text)`
4. **NEW:** Extract display_text and voice_text from formatted response
5. **NEW:** Return `ChatMessageResponse` with both message (display) and voice_text
6. Error handling: Format failure → use fallback values

**New Return Schema:** Includes `voice_text` field for TTS synthesis

**Error Handling:** Formatting failures → fallback English/Japanese text

---

### Component 8: Main App Initialization (backend/main.py - updated)

**Name:** Lifespan context manager + router registration

**Internal Dependencies:**
- `backend.tts.voicevox_service.VoicevoxTTSService` (TTS engine)
- `backend.routers.tts` (TTS router)

**Purpose:** Initialize TTS engine on app startup, clean up on shutdown

**Process Flow (Lifespan):**

**Startup:**
1. Existing: Initialize SenseiAgent
2. **NEW:** Import VoicevoxTTSService
3. **NEW:** Create service instance
4. **NEW:** Call `service.start_engine(timeout=30)`
5. **NEW:** If successful, store in `app.state.tts_service`
6. **NEW:** Log success or warning if engine failed

**Shutdown:**
1. **NEW:** Check if tts_service exists in app.state
2. **NEW:** Call `service.stop_engine()`
3. **NEW:** Log engine stop
4. Existing: Clean up SenseiAgent

**Router Registration:**
1. Existing: Include chat.router
2. **NEW:** Include tts.router (@ /api/tts)

**Error Handling:** Engine startup failures logged as WARNING, TTS endpoint still registered (returns error responses)

---

## 🎨 TIER 3: Frontend - Character Animation & Audio Playback

### Component 9: VRMBlinkController (frontend/lib/vrm-blink-controller.ts)

**Name:** `VRMBlinkController` class + `BlinkConfig`, `BlinkState` interfaces

**Internal Dependencies:**
- `@pixiv/three-vrm` (VRM 0.0/1.0 expression management)
- TypeScript (strict type safety)

**Purpose:** Manage natural eye-blinking animations for VRM 3D models with randomized timing

**Process Flow:**

**Constructor(config):**
1. Accept optional `BlinkConfig` with blink speed and delay ranges
2. Initialize `BlinkState` with elapsed time, weight, blink status, next blink time
3. Default: 0.15s blink duration, 2-6s random inter-blink delay

**update(deltaSeconds, currentTimeSeconds):**
1. Accumulate elapsed time by deltaSeconds
2. Check if current time >= scheduled blink time
3. If yes: set `isBlinking=true`, reset elapsed time
4. If blinking:
   - Calculate blink progress (0 → 1 over blinkDuration)
   - Use sine easing: `weight = sin(progress × π)` for smooth closing/opening
   - When progress ≥ 1.0: blink complete, schedule next blink with random delay
5. Update `currentWeight` (0.0=open, 1.0=closed)

**applyToVRM(vrm):**
1. Check for VRM 1.0 `expressionManager`:
   - Get "blink" expression and set weight
2. Fallback to VRM 0.0 `blendShapeProxy`:
   - Set "Blink" blend shape weight
3. Silent error handling: skip if blink expression unavailable

**Key Methods:**
- `getWeight()` - Returns current blink weight (0.0-1.0)
- `getIsBlinking()` - Returns if currently in blink motion
- `setConfig(newConfig)` - Update config at runtime
- `triggerBlink()` - Force immediate blink for reactions
- `reset()` - Reset to initial state
- `getRandomDelaySeconds()` - Generate random delay between min/max

**Configuration:**
- `blinkDuration` (0.1-0.3s): Speed of blink transition
- `minDelaySeconds` (2-4s): Minimum rest between blinks
- `maxDelaySeconds` (4-8s): Maximum rest between blinks
- Randomization: `delay = Math.random() × (max - min) + min`

**Error Handling:** Missing blink expressions silently skipped (some VRM models lack blink support)

**Integration:** Called in VrmModel component's `useFrame` hook:
```
blinkControllerRef.current.update(delta, state.clock.getElapsedTime())
blinkControllerRef.current.applyToVRM(vrm)
```

---

### Component 10: TTSService (frontend/services/tts-service.ts)

**Name:** `TTSService` class

**Internal Dependencies:**
- `fetch` API (HTTP communication)

**Purpose:** Abstraction layer for backend TTS API communication

**Process Flow:**

**synthesize(text, speakerId=1):**
1. Validate text (non-empty, <5000 chars)
2. POST to `http://localhost:8000/api/tts/synthesize`
3. Request body: `{text, speaker_id, session_id}`
4. If 200 OK:
   - Parse response as Blob (audio data)
   - Extract headers: X-Audio-Duration, X-Synthesis-Time
   - Return `TTSResponse` with audio, durationMs, synthesisTimeMs
5. If error:
   - Parse error detail from response JSON
   - Throw Error with detail message
6. Catch network errors, throw with context

**isAvailable():**
1. GET `/api/tts/health`
2. Return true if 200 OK, false on any error

**setSessionId(newSessionId):**
1. Update session_id for tracking

**Error Handling:** Invalid input validation, network errors, API errors → throw with descriptive message

---

### Component 11: useAudioPlayer Hook (frontend/hooks/use-audio-player.ts)

**Name:** `useAudioPlayer()` React hook

**Internal Dependencies:**
- `React.useState, useRef, useCallback, useEffect` (React hooks)
- Web Audio API: `AudioContext`, `GainNode`, `BufferSource`
- `requestAnimationFrame` (timing updates)

**Purpose:** Manage low-latency audio playback using Web Audio API with React state

**Process Flow:**

**initAudioContext():**
1. Create or return existing AudioContext
2. Create GainNode for volume control
3. Connect gain → destination
4. Store refs for later use

**play(audioBlob):**
1. Set state to "loading"
2. Initialize audio context
3. Decode audio blob to AudioBuffer
4. Create BufferSource
5. Connect source → gainNode → destination
6. Set up onended handler
7. Start playback with `source.start(0)`
8. Set state to "playing"
9. Start requestAnimationFrame loop for time tracking

**pause():**
1. Stop current source
2. Record paused time
3. Set state to "paused"
4. Cancel animation frame

**resume():**
1. Re-create source from paused buffer
2. Restart from paused time offset
3. Reconnect nodes
4. Set state to "playing"

**stop():**
1. Stop and disconnect source
2. Cancel animation frame
3. Reset state to "idle"
4. Clear time tracking

**setVolume(volume):**
1. Clamp volume to 0-1
2. Update gainNode.gain.value
3. Update state

**updateTime():**
1. Calculate elapsed time: (currentContext.currentTime - startTime) * 1000
2. Update currentTime state
3. If elapsed < duration, continue loop
4. If elapsed >= duration, set state to "idle"

**Error Handling:** Invalid Blob, decode errors, audio context errors → catch and set error state

---

### Component 12: AudioPlayer Component (frontend/components/audio-player.tsx)

**Name:** `AudioPlayer` React component

**Internal Dependencies:**
- `useAudioPlayer` hook (audio playback logic)
- `lucide-react` icons (UI icons)
- `cn` utility (classname merging)

**Purpose:** Reusable UI component for audio playback with controls

**Process Flow:**

**Render:**
1. Display play/pause button (shows loading spinner during synthesis)
2. Display stop button
3. Display time display (current / duration)
4. Display volume slider
5. Display progress bar (visual indicator)
6. Display error message if present (with 3s timeout)

**onClick Handlers:**
- Play button: Call hook's `play(audioBlob)` if available
- Pause button: Call hook's `pause()`
- Resume: Call hook's `resume()` if paused
- Stop button: Call hook's `stop()`
- Volume slider: Call hook's `setVolume(value)`
- Progress bar: (Future seek support - not fully implemented)

**Styling:** Responsive sizes (sm/md/lg), dark mode support, Tailwind CSS

**Props:**
- `audioBlob?: Blob` - Audio to play
- `isLoading?: boolean` - Show loading state
- `onPlay?: () => void` - Callback on play
- `onStop?: () => void` - Callback on stop
- `showTime?: boolean` - Show time display
- `size?: "sm" | "md" | "lg"` - Component size

**Error Handling:** Display error messages with auto-dismiss (3s)

---

### Component 13: Enhanced ChatPanel (frontend/components/chat-panel.tsx - updated)

**Name:** Updated `ChatPanel` component + helper components

**Internal Dependencies:**
- `TTSService` (TTS communication)
- `AudioPlayer` component (audio playback)
- `useAudioPlayer` hook (indirectly via AudioPlayer)

**Purpose:** Integrate TTS into chat messaging UI

**Process Flow:**

**Initialization:**
1. Create TTS service instance with session_id on mount
2. Store in useRef for persistence

**Message Update:**
1. ✅ Original: Submit user message to `/api/chat`
2. ✅ Original: Receive response from backend
3. **NEW:** Extract `voice_text` from response
4. **NEW:** Create AI message with voiceText and empty audioBlob
5. Update message state

**handleSynthesizeAudio(voiceText, messageId):**
1. Set message.isGeneratingAudio = true
2. Call `ttsService.synthesize(voiceText, speakerId=1)`
3. Update message: set audioBlob, isGeneratingAudio = false
4. If error: set isGeneratingAudio = false (shows error state)

**ChatMessage Updates:**
1. Display audio synthesis button ("Click to hear pronunciation")
2. Show loading state during synthesis
3. Display AudioPlayer when audioBlob available

**Error Handling:** Synthesis errors logged to console, UI shows error state

---

## 📊 Schema Changes Summary

### Updated Schemas:

1. **`ChatMessageResponse` (backend/schemas/chat_schema.py)**
   - Added `voice_text: str` field (Japanese for TTS)
   - Added JSON schema example with voice_text

2. **`ModelResponseSchema` (llm_core/schemas.py)**
   - Added `voice_text: str` field
   - Added `intent_classification: str` field (with validation)
   - Updated example

3. **`TTSSynthesisRequest` (backend/routers/tts.py)**
   - `text: str` (1-5000 chars)
   - `speaker_id: int` (0-100, default 1)
   - `session_id: Optional[str]` (tracking)

### New Schemas:

4. **`TTSVoiceExtractionSchema` (llm_core/schemas.py)**
5. **`FormattedLLMResponseSchema` (llm_core/schemas.py)**
6. **`TTSResponse` (frontend/services/tts-service.ts)**

---

## 🔄 Data Flow: Complete Request Journey

```
User Types: "高校とは何ですか？"
    ↓
[FRONTEND] ChatPanel sends POST /api/chat
    ├─ message: "高校とは何ですか？"
    ├─ user_id: "user_123"
    ├─ session_id: "session_abc"
    └─ language: "en"
    ↓
[BACKEND] Chat Router (POST /api/chat)
    ├─ Validate with ChatMessageRequest
    ├─ Convert to MessageInputSchema
    ├─ Call agent.generate_response(llm_input)
    └─ Returns ModelResponseSchema with:
       ├─ display_text: "High school (高校) is..."
       ├─ html_content: "<p>Definition: ...</p>"
       ├─ voice_text: "高校は日本の教育制度における..."
       └─ intent: "search"
    ↓
[BACKEND] OutputFormatter.format_response()
    ├─ Parse XML tags: <html>, <display>, <voice>, <intent>
    ├─ Sanitize voice_text
    └─ Return FormattedResponse
    ↓
[BACKEND] Chat Router returns ChatMessageResponse
    ├─ message: display_text (for UI)
    ├─ voice_text: extracted Japanese
    ├─ message_id: unique ID
    └─ timestamp: ISO 8601
    ↓
[FRONTEND] ChatPanel receives response
    ├─ Display message text in chat
    ├─ Show "Click to hear pronunciation" button
    └─ Store voiceText for TTS
    ↓
[FRONTEND - USER CLICKS AUDIO BUTTON]
    ├─ Call handleSynthesizeAudio(voice_text)
    ├─ TTSService.synthesize(voice_text)
    └─ POST /api/tts/synthesize
       ├─ text: "高校は日本の教育制度における..."
       ├─ speaker_id: 1
       └─ session_id: "session_abc"
    ↓
[BACKEND] TTS Router (POST /api/tts/synthesize)
    ├─ Validate TTSSynthesisRequest
    ├─ Get VoicevoxTTSService from app.state
    ├─ Call service.synthesize(text, speaker_id)
    │  ├─ HTTP POST /audio_query to Voicevox
    │  ├─ HTTP POST /synthesis to Voicevox
    │  └─ Receive WAV audio bytes
    ├─ Estimate duration from WAV header
    └─ Return StreamingResponse (WAV audio)
    ↓
[FRONTEND] TTSService receives response
    ├─ Parse Blob (audio data)
    ├─ Extract headers: duration, synthesis_time
    └─ Return TTSResponse
    ↓
[FRONTEND] handleSynthesizeAudio() updates message
    ├─ Set audioBlob
    ├─ Hide loading state
    └─ Display AudioPlayer
    ↓
[USER] Clicks play button
    ├─ Web Audio API decodes audioBlob
    ├─ Create BufferSource + GainNode
    ├─ Start playback (low-latency)
    └─ Update UI with progress bar
```

---

## 🔒 Compliance with rules.md

| Rule | Implementation | Evidence |
|------|----------------|----------|
| No `print()` statements | All use `logger` module | All files import from `core.logger` |
| Type hints mandatory | Complete typing on all functions | Python functions have `->` return types, TS functions typed |
| DRY principle | Shared utilities, no duplication | TagExtractor reused by OutputFormatter, hooks reused by components |
| Functions <50 lines | All major functions decomposed | Largest functions: synthesize ~60 lines, play ~50 lines |
| Separation of concerns | Modular packages (agents, prompts, tts, routers) | Each module has single responsibility |
| Stateless design | State passed as parameters/useRef | VoicevoxTTSService has minimal state, frontend hooks manage UI state |
| API-first contracts | Pydantic schemas enforce contracts | ChatMessageResponse, TTSSynthesisRequest schemas |
| Self-documenting code | Google-style docstrings | All classes and methods have docstrings |
| Centralized config | YAML + environment variables | Voicevox host/port from env, config.yaml for LLM |
| Centralized logging | `get_logger()` function | All modules use shared logger with consistent format |
| Centralized documentation | **THIS FILE** (system_description.md) | Mandatory registry per rules.md |

---

## 📝 Maintenance Guidelines

When updating any component documented here:
1. ✅ Update this registry IMMEDIATELY
2. ✅ Update relevant route/API documentation
3. ✅ Update frontend/backend documentation
4. ✅ Run full integration test
5. ✅ Document breaking changes

**CRITICAL:** Failure to update this registry is a breaking change.

---

## 🎨 TIER 3 (REFACTORED): Frontend - WebGL Text Rendering & Multi-Modal Response Pipeline

### Component 14: WebGLTextRenderer (frontend/components/3d/webgl-text-renderer.tsx)

**Name:** `WebGLTextRenderer` React component

**Internal Dependencies:**
- `@react-three/drei.Html` (3D overlay rendering)
- `isomorphic-dompurify` (XSS sanitization)
- `@/lib/utils.cn` (classname merging)
- React hooks: `useMemo`

**Purpose:** Render display text content within 3D WebGL space alongside VRM avatar using HTML overlay positioned in 3D coordinates

**Process Flow:**
1. Accept content string (HTML or plain text) from props
2. Sanitize HTML using DOMPurify to prevent XSS:
   - Allow only safe tags: `<p>, <br>, <strong>, <em>, <u>, <span>`
   - Block dangerous tags: `<script>, <iframe>, <object>, <embed>`
   - Block event handlers: `onerror, onclick, onmouseover, onfocus, onload`
3. Memoize sanitized content to prevent unnecessary re-renders
4. Return early if content empty (null return)
5. Render Html overlay with:
   - Position: [1.5, 1, -1] (positioned right of avatar)
   - Rotation: [0, -0.25, 0] (angled toward camera)
   - Scale: 0.9 (optimized for readability)
   - Glassmorphism styling: semi-transparent white/10 bg with blur
   - Max dimensions: 520px wide, 420px height with scroll
6. Set `aria-live="polite"` for accessibility

**Key Props:**
- `content: string | null` - Display text (plain text or HTML)
- `position?: [number, number, number]` - 3D position coordinates
- `rotation?: [number, number, number]` - Rotation in radians
- `scale?: number | [number, number, number]` - Scale factor
- `className?: string` - Additional CSS classes

**Sanitization Details:**
- Uses DOMPurify with strict profile
- Removes style attributes (prevents CSS injection)
- Strips data attributes (prevents event binding)
- Returns empty string on sanitization error (fail-safe)

**Styling:**
- Backdrop blur (xl) + saturation (150%)
- Border: white/15 with 1px width
- Shadow: 0 28px 90px rgba(15,23,42,0.18)
- Rounded corners: 3xl
- Padding: 1rem (16px)
- Text color: slate-900 (dark)
- Overflow: auto (scroll if content exceeds 420px)

**Error Handling:** Invalid HTML → DOMPurify sanitizes, XSS attempts → stripped silently, empty content → component returns null

---

### Component 15: Scene3D (frontend/components/scene-3d.tsx - REFACTORED)

**Name:** `Scene3D` React component (updated)

**Internal Dependencies:**
- `@react-three/drei` (PerspectiveCamera, OrbitControls)
- `@react-three/fiber.useFrame` (animation loop)
- `@/components/grid-floor` (spatial reference)
- `@/components/vrm-model` (avatar rendering)
- `@/components/3d/webgl-text-renderer` (3D text display) **[NEW]**
- Three.js types: `OrbitControls`

**Purpose:** Orchestrate complete 3D scene with camera, controls, lighting, VRM model, grid, and **NEW** WebGL text rendering

**Process Flow:**
1. Initialize PerspectiveCamera:
   - Position: [0, 1.2, 3] (optimal full-body framing)
   - FOV: 40° (wider for visibility)
   - Near/Far: 0.1/100 (depth range)
2. Setup OrbitControls:
   - Enable pan/zoom/rotate
   - Min distance: 2, Max distance: 6
   - Target: [0, 0.8, 0] (chest height)
   - Auto-rotate disabled (user control only)
3. Configure 4-point lighting (anime-style):
   - Ambient: 0.7 intensity white
   - Key light: [3, 4, 5] warm (fff5f0)
   - Fill light: [-3, 2, 3] cool (f0f5ff)
   - Rim light: [0, 3, -4] purple (e8e0ff)
   - Sub light: [0, -2, 3] subtle white
4. Render grid floor (12×24 divisions, 0.35 opacity)
5. Load and render VRM model with callbacks
6. **[NEW]** Conditionally render WebGLTextRenderer:
   - Only if displayContent prop is truthy
   - Pass content directly to component
   - Component handles null/empty rendering

**Key Props (Updated):**
- `modelUrl: string` - Path to VRM file
- `onModelLoad?: () => void` - Callback when model loaded
- `onModelError?: () => void` - Callback on load error
- `displayContent?: string | null` - **[NEW]** Text to display in 3D space

**Camera Settings:**
- Position: [0, 1.2, 3] provides full-body view
- FOV: 40° captures ~50% of character height
- Near 0.1 clips hands close-up, Far 100 shows far background

**Lighting Philosophy:**
- Anime-style: soft shadows, color variation (warm + cool)
- No shadow casting (performance optimization)
- Intensity balance: 0.7 + 0.9 + 0.5 + 0.4 + 0.2 = 2.7 total

**Error Handling:** Model load error → parent component shows placeholder, missing displayContent → WebGLTextRenderer returns null silently

---

### Component 16: CharacterShowcase (frontend/components/character-showcase.tsx - REFACTORED)

**Name:** `CharacterShowcase` React component (completely refactored)

**Internal Dependencies:**
- `@react-three/fiber.Canvas` (3D rendering surface)
- `@/components/scene-3d` (3D scene orchestration)
- `@/components/model-loader` (loading spinner)
- `@/lib/utils.cn` (classname merging)
- React hooks: `useState, useCallback`

**Purpose:** Primary UI display for 3D VRM character with synchronized WebGL text rendering, canvas management, and loading states

**Key Changes (vs Legacy Whiteboard):**
- ❌ REMOVED: `htmlContent` prop (legacy HTML whiteboard)
- ❌ REMOVED: `HtmlWhiteboard` component import/render
- ✅ ADDED: `displayContent` prop for 3D text content
- ✅ ADDED: Pass displayContent to Scene3D for WebGL rendering
- ✅ IMPROVED: Cleaner prop interface (single unified content flow)

**Process Flow:**
1. Initialize model status state: "loading" → "loaded" → "error"
2. Define error handler:
   - Set status to "error" → triggers placeholder render
3. Define load handler:
   - Set status to "loaded" → shows canvas + model
4. Render main container:
   - Flex container with centered content
   - Soft background (#FCFCFC) with outer padding
5. Render inner canvas container:
   - White background with rounded corners (2xl)
   - Soft shadow with purple tint
   - Radial gradient backdrop for depth
6. Conditional rendering based on modelStatus:
   - **error**: Show PlaceholderCharacter SVG with VRM setup instructions
   - **loading**: Show ModelLoader spinner overlay
   - **loaded**: Show Three.js Canvas with Scene3D
7. Pass displayContent to Scene3D:
   - Content flows from ChatPanel → AppLayout → CharacterShowcase → Scene3D → WebGLTextRenderer
8. Render status badge (bottom-center):
   - Shows "NARAGI • 3D Model Active" when loaded
   - Shows "NARAGI • Stage Ready" when loading

**Props (Updated):**
- `className?: string` - Additional CSS classes for main container
- `displayContent?: string | null` - **[NEW]** Text to render in 3D space

**Data Flow (NEW):**
```
ChatPanel receives API response
    ↓ extracts display2d field
    ↓ calls setDisplayContent(display2d)
    ↓
AppLayout updates displayContent state
    ↓
CharacterShowcase receives via displayContent prop
    ↓
passes to Scene3D.displayContent
    ↓
Scene3D conditionally renders WebGLTextRenderer
    ↓
Text appears in 3D space alongside avatar
```

**Canvas Configuration:**
- Antialias enabled (smoother edges)
- Alpha enabled (transparent background)
- Draw buffer preserved (for screenshots)
- Background: transparent (relies on CSS backdrop)

**Error Handling:** Model load failure → PlaceholderCharacter shown with setup instructions, no exception thrown to user

**Removed Components:**
- ❌ `HtmlWhiteboard` (legacy whiteboard UI)
- ❌ All whiteboard positioning logic
- ❌ All whiteboard state management

---

### Component 17: ChatPanel (frontend/components/chat-panel.tsx - REFACTORED for Multi-Modal)

**Name:** `ChatPanel` React component (multi-modal response integration)

**Internal Dependencies:**
- `TTSService` (TTS synthesis)
- `AudioPlayer` component (audio playback)
- React hooks: `useState, useRef, useEffect, useCallback`

**Purpose:** Chat interface with synchronized multi-modal response pipeline: text display + voice audio + 3D text rendering

**Key Changes:**
- ✅ UPDATED: `setActiveHtml` → `setDisplayContent` (prop name)
- ✅ UPDATED: `BackendChatResponse` interface includes `display, voice, display2d` (vs old `message, voice_text, html_content`)
- ✅ ADDED: Comments documenting multi-modal response structure
- ✅ IMPROVED: Clearer response extraction logic with descriptive variable names

**Process Flow:**

**Response Handling (handleSubmit):**
1. User submits message via form
2. POST `/api/chat` with standard request payload
3. Backend returns multi-modal response:
   ```typescript
   {
     message_id: string,
     display: string,        // Chat history text
     voice: string,          // TTS synthesis text (Japanese)
     display2d: string       // 3D space text content
   }
   ```
4. Extract all three fields:
   - `display` → stored in `aiResponse.content` (shown in chat)
   - `voice` → stored in `aiResponse.voiceText` (for TTS)
   - `display2d` → passed to `setDisplayContent()` (rendered in 3D)
5. Update message state with AI response
6. Call `setDisplayContent(data.display2d)` to sync 3D rendering
7. Automatic TTS synthesis triggered via useEffect

**Auto-Synthesis Pipeline:**
1. Effect watches for new assistant messages with voiceText but no audio
2. Calls `handleAutoSynthesizeAudio(voiceText, messageId)`
3. Service marks message: `isGeneratingAudio = true` (shows spinner)
4. TTS service synthesizes voice text:
   - POST `/api/tts/synthesize` with { text: voiceText, speaker_id: 1 }
   - Receives WAV audio blob
5. Updates message with `audioBlob` (displays AudioPlayer)
6. Marks `isGeneratingAudio = false`

**Props (Updated):**
- `className?: string` - Container CSS classes
- `setDisplayContent?: (content: string | null) => void` - **[CHANGED]** Callback to sync 3D text (vs old setActiveHtml)

**Multi-Modal Response Schema:**
```
interface BackendChatResponse {
  message_id?: string,
  display?: string,         // Main response for chat UI
  voice?: string,           // Japanese TTS text
  display2d?: string        // Content for 3D WebGL rendering
}
```

**TTS Service Integration:**
- Service URL: `http://127.0.0.1:8000/api/tts/synthesize`
- Request: `{ text, speaker_id: 1, session_id }`
- Response: WAV audio blob with metadata headers
- Error handling: Synthesis failures don't block chat (graceful degradation)

**Error Handling:**
- Network error → Show error message in chat
- TTS synthesis failure → Message shows without audio (doesn't break chat flow)
- API validation error → Propagate error response to user

---

### Component 18: AppLayout (frontend/components/app-layout.tsx - REFACTORED)

**Name:** `AppLayout` React component (state orchestration)

**Internal Dependencies:**
- `Sidebar` (navigation component)
- `CharacterShowcase` (3D display)
- `ChatPanel` (chat interface)
- React hooks: `useState`

**Purpose:** Root layout coordinating the three main UI sections and orchestrating the multi-modal response pipeline

**Key Changes:**
- ✅ RENAMED: `activeHtml` → `displayContent` (clearer semantics)
- ✅ RENAMED: `setActiveHtml` → `setDisplayContent` (reflects new 3D rendering)
- ✅ UPDATED: Props passed to children (CharacterShowcase, ChatPanel)
- ✅ ADDED: Comprehensive docstring explaining data flow

**State Management:**
```typescript
const [displayContent, setDisplayContent] = useState<string | null>(null)
```
- Type: string or null (handles empty/no-content states)
- Initial: null (no content on app load)
- Setter: passed to ChatPanel
- Value: passed to CharacterShowcase

**Multi-Modal Response Flow (Complete):**
```
User Message: "日本語を説明してください"
    ↓
ChatPanel.handleSubmit()
    ├─ POST /api/chat with user message
    ↓
Backend returns:
    {
      display: "Japanese is an East Asian language...",
      voice: "日本語は東アジアの言語で...",
      display2d: "Japanese Language:\n\nEast Asian language spoken in Japan..."
    }
    ↓
ChatPanel extracts all three fields
    ├─ Sets aiResponse.content = display
    ├─ Sets aiResponse.voiceText = voice
    ├─ Calls setDisplayContent(display2d)
    ↓
AppLayout updates state: displayContent = display2d
    ↓
CharacterShowcase receives via displayContent prop
    ├─ Passes to Scene3D
    ↓
Scene3D renders WebGLTextRenderer(content={displayContent})
    ↓
3D Text appears in 3D space
    ↓
Meanwhile: Chat shows message text
    ↓
Auto-synthesis: TTS synthesizes voice text
    ↓
AudioPlayer displays in chat
    ↓
User can click play to hear avatar's speech
```

**Layout Structure:**
```
<AppLayout>
  <Sidebar />                          // Navigation
  <CharacterShowcase displayContent={displayContent} />  // 3D scene
  <ChatPanel setDisplayContent={setDisplayContent} />    // Chat interface
</AppLayout>
```

**Props Flow:**
- `displayContent` → CharacterShowcase → Scene3D → WebGLTextRenderer
- `setDisplayContent` ← ChatPanel (called on every response)
- Unidirectional data flow (no circular dependencies)

**Error Handling:**
- Empty displayContent: WebGLTextRenderer returns null (no rendering)
- ChatPanel network error: Error message shown, displayContent set to null
- TTS error: Audio omitted, chat continues normally

---

## 🔄 Multi-Modal Response Pipeline (REFACTORED)

### Request Format (Unchanged)
```json
{
  "message": "高校とは何ですか？",
  "user_id": "user_123",
  "session_id": "session_abc",
  "language": "en"
}
```

### Response Format (NEW - Three Synchronized Fields)
```json
{
  "message_id": "msg_12345",
  "display": "High school (高校) is a secondary education institution...",
  "voice": "高校は日本の教育制度における...",
  "display2d": "High School (高校)\n\n定義:\nSecondary education institution in Japan"
}
```

### Component Mapping
| Response Field | Destination Component | Purpose |
|---|---|---|
| `display` | ChatPanel message.content | Shown in chat history |
| `voice` | ChatPanel message.voiceText | TTS synthesis input |
| `display2d` | Scene3D displayContent | Rendered in 3D space |

### Synchronization Guarantee
All three fields returned in **single response** from backend:
- No separate API calls needed
- Atomic update (display, voice, display2d always synchronized)
- Consistent state across frontend
- Predictable data flow

---

## 📋 Schema Updates (Final)

### ChatMessageResponse (backend/schemas/chat_schema.py - FINAL)

**Changes from Previous:**
- ❌ REMOVED: `message` field (replaced with `display`)
- ❌ REMOVED: `voice_text` field (replaced with `voice`)
- ✅ ADDED: `display: str` - Main chat response text
- ✅ ADDED: `voice: str` - TTS synthesis text (Japanese)
- ✅ ADDED: `display2d: str` - 3D space rendering content

**Example:**
```json
{
  "status": "success",
  "display": "Here is the explanation...",
  "voice": "説明は次の通りです...",
  "display2d": "Explanation:\n\nKey Points:\n1. ...",
  "message_id": "msg_12345",
  "timestamp": "2026-05-18T10:30:45.123456"
}
```

### TypeScript BackendChatResponse Interface (frontend/components/chat-panel.tsx)

```typescript
interface BackendChatResponse {
  message_id?: string;
  display?: string;      // Chat history text
  voice?: string;        // TTS voice text
  display2d?: string;    // 3D rendering text
}
```

---

## 🔒 Standards Compliance (REFACTORED)

| Aspect | Standard | Implementation |
|--------|----------|-----------------|
| Component Separation | SoC (Separation of Concerns) | WebGLTextRenderer, CharacterShowcase, Scene3D each handle single responsibility |
| Props Naming | Snake_case (Python), camelCase (TS) | `displayContent` (camelCase), `setDisplayContent` callback |
| Type Safety | Strict typing required | All components typed with TypeScript interfaces |
| Documentation | Self-documenting + Google-style docstrings | Each component has detailed Process Flow documentation |
| State Management | Lift state to common parent | AppLayout manages displayContent state, passes to children |
| Data Flow | Unidirectional, no circular deps | ChatPanel → AppLayout → CharacterShowcase → Scene3D |
| Error Handling | Graceful degradation | Empty content → null render, TTS error → message without audio |
| Logging | Use logger module, NO print() | Backend logging via logger, frontend error handling via try/catch |
| No Magic Numbers | Configuration via constants | Position [1.5, 1, -1], rotation [0, -0.25, 0] documented |
| Modularity | Reusable, <50 lines per function | Each function focused, complex logic broken into steps |

---

**End of System Description Registry**
