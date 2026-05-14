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

**End of System Description Registry**
