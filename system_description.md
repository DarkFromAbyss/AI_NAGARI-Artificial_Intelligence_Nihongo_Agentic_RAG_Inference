# AI NARAGI - System Description Registry

**Last Updated:** May 26, 2026  
**Version:** 1.6.0 (Centralized Audio Management - No Overlapping Playback)

---

## 📋 Registry Overview

This document serves as the **single source of truth** for all system components, functions, and modules in AI NARAGI. Every component created or modified during language detection implementation is documented here with:
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

## 🔊 TIER 2: Backend - Language Detection & TTS Engine

### Component 5: LanguageDetectionService (backend/services/language_detector.py)

**Name:** `detect_language()`, `get_language_confidence()` functions + utility functions

**Internal Dependencies:**
- `re` (Python standard library for regex pattern matching)
- `langdetect` library (fallback probabilistic detection, gracefully degraded if unavailable)
- `backend.core.logger` (logging)

**Purpose:** Ultra-fast, real-time language identification for incoming user queries with sub-millisecond latency

**Process Flow:**

**detect_language(text: str) → str:**
1. Validate and normalize input (check for None, empty, whitespace-only)
2. **Fast Path - Script Detection:** Apply regex to scan for Japanese characters (Hiragana, Katakana, Kanji) in O(n) time
3. If Japanese scripts detected: return "ja" immediately (negligible overhead, no further processing)
4. **Probabilistic Detection:** If langdetect library available, call `langdetect.detect(text)` with error handling
5. Validate detected language is in supported set (en, vi, ja); if unsupported return None
6. **Fallback - Heuristics:** If langdetect unavailable or fails, scan for Vietnamese diacritics (ả, ế, ũ, etc.)
7. If Vietnamese markers found: return "vi"
8. Count Latin letters (a-z, A-Z) in text; if >50% are Latin: return "en"
9. Default to "en" (conservative fallback for ambiguous cases)
10. Log detection method and result at DEBUG level for monitoring

**Key Methods:**
- `detect_language(text)` - Main detection pipeline, returns ISO 639-1 code
- `_detect_with_langdetect(text)` - Probabilistic detection with LangDetectException handling
- `_detect_with_heuristics(text)` - Fallback pattern matching and character analysis
- `get_language_confidence(text)` - Returns tuple of (language_code, confidence_0_to_1)

**Language Code Mapping:**
- "ja": Japanese (hiragana [\u3040-\u309F], katakana [\u30A0-\u30FF], kanji [\u4E00-\u9FFF])
- "en": English (Latin characters + fallback for ambiguous text)
- "vi": Vietnamese (diacritics + heuristic analysis)

**Detection Confidence Levels:**
- 1.0: Japanese scripts detected (highest confidence, deterministic)
- 0.85: langdetect result (very reliable probabilistic detection)
- 0.6: Heuristics fallback (acceptable confidence but lower certainty)

**Performance Characteristics:**
- Japanese detection: O(n) single regex scan, <0.1ms on typical 100-2000 char queries
- langdetect fallback: 5-50ms depending on text length (probabilistic analysis)
- Heuristics: O(n) character scan, <1ms
- Overall latency: Negligible overhead due to early-exit on Japanese detection (~99% of expected Japanese queries)

**Error Handling:**
- Invalid input (None, non-string): log DEBUG, return "en"
- Empty/whitespace-only text: log DEBUG, return "en"
- langdetect unavailable: log WARNING on import, silently degrade to heuristics
- langdetect exception: log DEBUG, fall through to heuristics
- Unsupported language detected: log DEBUG, return None and try heuristics

**Integration Points:**
- Called in `backend/routers/chat.py` STEP 2A: Auto-detect language from incoming user message
- Passed to `MessageInputSchema` as `language` field
- Result logged with metadata `language_detected=true/false`

**Example Usage:**
```python
from services.language_detector import detect_language

user_message = "こんにちは、日本語を勉強しています。"
lang = detect_language(user_message)  # Returns: "ja"

user_message2 = "Hello, how are you?"
lang2 = detect_language(user_message2)  # Returns: "en"

lang_with_confidence = get_language_confidence("Xin chào")
# Returns: ("vi", 0.6)
```

---

### Component 6: VoicevoxTTSService (backend/tts/voicevox_service.py)

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

### Component 7: TTS Router (backend/routers/tts.py)

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

### Component 8: Extended Chat Router (backend/routers/chat.py - updated)

**Name:** `POST /api/chat` endpoint (updated) + LanguageDetectionService integration

**Internal Dependencies:**
- `backend.services.language_detector.detect_language` (auto language detection)
- `llm_core.output_formatter.OutputFormatter` (tag extraction)
- `backend.schemas.chat_schema.ChatMessageResponse` (response schema)

**Purpose:** Auto-detect query language with robust error handling and extract both display and voice text from LLM output for dual delivery

**Process Flow (Enhanced STEP 2A - Robust Language Detection):**
1. ✅ Original: Generate message_id, log request, get agent
2. ✅ Original: Validate agent availability
3. **NEW (STEP 2A):** Robust language detection with three-tier fallback:
   - **Tier 1 (Explicit):** If request.language provided and valid (en/vi/ja), use immediately
   - **Tier 2 (Auto-detect):** Call `detect_language(request.message)` wrapped in try-except
   - **Tier 3 (Fallback):** Default to "en" on any error, exception, or unsupported detected language
4. **NEW:** Validate detected language is in (en, vi, ja); if not, log warning and fall back to "en"
5. **NEW:** Wrap entire detection logic in comprehensive try-except with full error context
6. **NEW:** Final validation before passing to MessageInputSchema (defensive programming)
7. **NEW:** Track detection method in metadata: explicit/auto-detected/fallback_*
8. ✅ Original: Create MessageInputSchema with validated language
9. ✅ Original: Invoke SenseiAgent with language-aware input
10. **NEW:** Extract display_text and voice_text from LLM response
11. **NEW:** Return ChatMessageResponse with all three components (display, voice, display2d)

**Enhanced Error Handling Strategy:**

**Try-Except Wrapper:**
```python
try:
    # Priority 1: Explicit language (if provided and valid)
    if request.language and request.language in ("en", "vi", "ja"):
        display_lang = request.language
        language_detection_method = "explicit"
    
    # Priority 2: Auto-detect (only if message is valid string)
    elif request.message and isinstance(request.message, str):
        detected = detect_language(request.message)
        if detected in ("en", "vi", "ja"):
            display_lang = detected
            language_detection_method = "auto-detected"
        else:
            # Unsupported language returned from detector
            logger.warning(f"Unsupported language '{detected}'; falling back to 'en'")
            display_lang = "en"
            language_detection_method = "fallback_unsupported"
    
    else:
        # Invalid message format
        logger.warning(f"Invalid message type or format; falling back to 'en'")
        display_lang = "en"
        language_detection_method = "fallback_invalid"

except Exception as detection_error:
    # Catch ALL exceptions (import errors, runtime errors, network issues, etc.)
    logger.error(f"Language detection error: {str(detection_error)}", exc_info=True)
    display_lang = "en"
    language_detection_method = "fallback_exception"

# Final validation: double-check display_lang is valid before passing downstream
if display_lang not in ("en", "vi", "ja"):
    logger.warning(f"Final validation failed; forcing to 'en'")
    display_lang = "en"
    language_detection_method = "fallback_final_validation"
```

**Metadata Tracking:**
- `message_id`: Unique tracking identifier
- `source`: Always "frontend"
- `timestamp`: ISO format UTC time
- `language_detected_auto`: Boolean (true if auto-detected via AI)
- `language_detection_method`: String (explicit/auto-detected/fallback_unsupported/fallback_invalid/fallback_exception/fallback_final_validation)

**Logging Coverage:**
- **DEBUG:** Explicit language provided, MessageInputSchema creation success
- **INFO:** Auto-detection completed successfully (including text preview)
- **WARNING:** Unsupported language detected, invalid message format, final validation failure
- **ERROR:** Exception during detection (with full traceback)

**Error Handling Guarantees:**
- ✅ Language detection NEVER crashes the endpoint (all exceptions caught)
- ✅ `display_lang` is ALWAYS one of (en, vi, ja) before passing to MessageInputSchema
- ✅ Downstream LLM receives validated language parameter (no schema errors)
- ✅ Complete traceability: metadata field shows detection method for every request

**New Return Schema:** `ChatMessageResponse` includes `voice_text` field for TTS synthesis

---

### Component 9: Main App Initialization (backend/main.py - updated)

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

### Component 10: VRMBlinkController (frontend/lib/vrm-blink-controller.ts)

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

### Component 11: TTSService (frontend/services/tts-service.ts)

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
1. Accept content string (Markdown or plain text) from props
2. Parse markdown using react-markdown with custom component renderers:
   - Headings: centered (text-center) with border separators
   - Paragraphs: centered text with proper line-height
   - Lists: centered flex layout with centered list items
   - Code blocks: inline (styled as tags) and block (monospace overflow)
   - Tables: centered with border styling, overflow handling
   - Blockquotes: centered with left border and background tint
3. Memoize content validation to prevent unnecessary re-renders
4. Return early if content empty (null return)
5. Render Html overlay with **LOCKED POSITIONING**:
   - **Position: [0, 1.5, -2.5]** (CRITICAL FIX - directly behind model, centered)
     - x=0: Centered horizontally (aligned with VRM model center)
     - y=1.5: Grounded at chest height (not floating)
     - z=-2.5: Placed directly BEHIND model (negative Z = away from camera)
   - Rotation: [0, 0, 0] (level alignment, no tilt)
   - Scale: 0.2 (optimized for readability)
   - **center={true}** (CRITICAL FIX - centers pivot point at assigned coordinate)
   - **transform={true}** (Applies transformations relative to centered pivot)
   - Glassmorphism styling: semi-transparent white/10 bg with blur
   - Max dimensions: 520px wide, 280-420px height with scroll
6. Apply **text-center** to container div (CRITICAL FIX - centers all internal content)
7. Render all markdown elements with center alignment (h1-h6, p, ul, ol, li, blockquote all text-center)
8. Set `aria-live="polite"` for accessibility

**Key Props:**
- `content: string | null` - Display text (markdown or plain text)
- `position?: [number, number, number]` - LOCKED to [0, 1.5, -2.5] by default
- `rotation?: [number, number, number]` - LOCKED to [0, 0, 0] (level)
- `scale?: number | [number, number, number]` - Locked to 0.2 (readability)
- `className?: string` - Additional CSS classes

**Positioning Guarantees (May 25, 2026 FIX):**
- Absolute position directly behind VRM model at origin
- Pivot point centered via <Html center={true} /> ensures visual center aligns exactly
- Eliminates drift/shifting: previous position [1, 1, -1] caused left-right skew
- Level grounding: fixed y=1.5 prevents tilting or floating unevenly
- Text centering: internal text-center class centers all content within box
- Result: Perfectly centered, grounded text box at fixed 3D coordinate

**Markdown Component Styling:**
- All headings (h1-h6): text-center, bordered separators
- Paragraphs: text-center, proper line-height
- Lists (ul/ol): flex flex-col items-center (centers list items)
- List items: text-center alignment
- Blockquotes: text-center, mx-auto (centers container)
- Code (inline): inline-block positioning
- Tables: flex justify-center wrapper for centered display
- Table cells: text-center for data rows
- Strong/em/del: inline formatting preserved

**Styling:**
- Backdrop blur (xl) + saturation (150%)
- Border: white/15 with 1px width
- Shadow: 0 28px 90px rgba(15,23,42,0.18)
- Rounded corners: 3xl
- Padding: 1rem (16px)
- Text color: slate-900 (dark)
- Text alignment: center (all content)
- Overflow: auto (scroll if content exceeds 420px)

**Error Handling:** Invalid markdown → react-markdown parses as fallback, dangerous tags → stripped by disallowedElements list, empty content → component returns null

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
1. User submits message via input
2. POST to /api/chat with message, session_id, language
3. Backend returns `BackendChatResponse` with display, voice, display2d
4. ChatPanel extracts response fields
5. Creates Message object with voiceText from response.voice
6. Calls setDisplayContent(response.display2d) and setStatusVoiceText(response.voice)
7. Updates message state, triggering auto-audio synthesis
8. Auto-synthesized audio blob stored in Message
9. TTS service manages audio queue to prevent overlapping playback

---

## 🎨 TIER 3: Frontend - Response Parsing & Status Indicator (NEW)

### Component 18: ResponseParser Utilities (frontend/utils/response-parser.ts - NEW)

**Name:** `ResponseParser` module with utility functions and `ParsedResponse` interface

**Internal Dependencies:**
- `RegExp` (JavaScript standard library for pattern matching)

**Purpose:** Extract XML tag content from backend LLM responses with robust regex matching and fallback logic

**Key Functions:**
- `extractXmlTagContent(xml, tagName)` - Core regex extractor for any XML tag
- `extractVoiceTag(responseText)` - Extract `<voice>...</voice>` tag content
- `extractDisplayTag(responseText)` - Extract `<display>...</display>` tag content
- `extractDisplay2dTag(responseText)` - Extract `<display2d>...</display2d>` tag content
- `hasVoiceTag(responseText)` - Boolean check for voice tag presence
- `sanitizeVoiceText(voiceText)` - Normalize whitespace in extracted text
- `parseBackendResponse(responseText, defaultDisplay)` - Full response parsing with fallbacks

**Process Flow:**
1. Accept raw response string from backend
2. Apply case-insensitive regex pattern: `<tagName\s*>([\\s\\S]*?)<\/tagName\s*>` for each tag
3. Extract matched content and strip leading/trailing whitespace
4. Return `ParsedResponse` object containing:
   - display: display tag content (fallback to "No response")
   - voice: voice tag content or null
   - display2d: display2d tag content or null
   - hasVoice: boolean flag for voice presence
5. Sanitize voice text by collapsing multiple whitespace to single space
6. Return fallbacks if tags missing

**Error Handling:**
- Invalid regex matches → return null
- Missing tags → use default values or null
- Malformed XML → extract best effort with regex (non-greedy matching)
- Empty extracted text → treat as null

---

### Component 19: Dynamic Status Indicator (Frontend Multi-Component Update)

**Name:** Status Badge Dynamic Update System

**Internal Dependencies:**
- `ChatPanel` (voice text extraction and passing)
- `AppLayout` (state management)
- `CharacterShowcase` (status badge rendering)

**Purpose:** Display AI voice response text in bottom status badge, dynamically updating on each user-agent interaction cycle

**Components Modified:**

**ChatPanel (frontend/components/chat-panel.tsx):**
- ✅ ADDED: `setStatusVoiceText` prop callback
- ✅ UPDATED: Pass `setStatusVoiceText(data.voice)` when response received
- ✅ Purpose: Extract voice tag from response and propagate upward

**AppLayout (frontend/components/app-layout.tsx):**
- ✅ ADDED: `statusVoiceText` state
- ✅ ADDED: `setStatusVoiceText` handler
- ✅ UPDATED: Pass both props to child components
- ✅ Purpose: Central state management for voice text lifecycle

**CharacterShowcase (frontend/components/character-showcase.tsx):**
- ✅ ADDED: `statusVoiceText` prop in interface
- ✅ ADDED: `getStatusBadgeText()` function with priority logic
- ✅ UPDATED: Status badge to call `getStatusBadgeText()`
- ✅ Purpose: Render voice text in UI with fallback to default

**Process Flow (User-Agent Interaction Cycle):**
1. User submits prompt in ChatPanel
2. ChatPanel calls backend API with message
3. Backend returns response with `<voice>...</voice>` tag
4. ChatPanel extracts voice text: `data.voice`
5. ChatPanel calls `setStatusVoiceText(data.voice)`
6. AppLayout state updates with new voice text
7. CharacterShowcase receives updated `statusVoiceText` prop
8. Component renders: Badge text → `getStatusBadgeText()` → returns `statusVoiceText` if present
9. UI updates dynamically (no full re-render needed, only badge text)
10. Automatic fallback to "NARAGI • 3D Model Active" when no voice text available

**Badge Text Priority (getStatusBadgeText function):**
1. Display voice text if available (extracted from `<voice>` tag) - **PRIMARY**
2. Display model status text if no voice text:
   - "NARAGI • 3D Model Active" if modelStatus === "loaded"
   - "NARAGI • Stage Ready" if modelStatus !== "loaded"
   - **FALLBACK**

**Error Handling & Edge Cases:**
- Missing `<voice>` tag in response → no voice text extracted → fallback to default
- Empty voice text after extraction → fallback to default
- Multiple responses in rapid succession → latest voice text overwrites previous
- Network error → statusVoiceText remains null → fallback to default
- Component unmount → state cleanup automatic (React lifecycle)

---

**Last Updated:** May 19, 2026  
**Version:** 1.4.0 (Dynamic Status Indicator - Voice Tag Integration)

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

## 🎨 TIER 4: Frontend UI Components - Responsive Navigation

### Component: Sidebar (frontend/components/sidebar.tsx)

**Name:** `Sidebar` React Component + Icon Components + `MenuItem` Helper Component

**Internal Dependencies:**
- `React` - `useState` hook for collapse/expand state management
- `@/lib/utils` - `cn()` utility for Tailwind className merging
- `@/components/ui/button` - Button component wrapper
- `@/hooks/use-theme` - Theme management hook for dark/light mode support

**Purpose:** Provides a responsive left navigation sidebar with collapsible functionality, clickable logo navigation, and main navigation items (Brain, Voice, Model) with utility buttons (Theme, Settings).

**Process Flow:**

1. **Component Initialization:**
   - Import useState hook and initialize `isExpanded` state (default: true)
   - Get theme context via useTheme hook (isSoftAnime flag)
   - Accept callbacks: onModelToggle, onLogoClick from parent component

2. **Logo Navigation (handleLogoClick):**
   - Detect click on NARAGI logo/text button
   - Call onLogoClick() callback to parent (AppLayout)
   - Parent handler sets isModelActive to false, returning to main chat interface
   - Visual feedback: hover effect shows bg-sidebar-accent/50, active shows bg-sidebar-accent
   - Cursor changes to pointer on hover (cursor-pointer Tailwind class)
   - Focus ring visible for keyboard navigation (focus-visible ring-2 ring-primary)

3. **Toggle Function (toggleSidebar):**
   - Update isExpanded state to opposite value
   - Tailwind classes automatically animate width transition (300ms ease-in-out)

4. **Conditional Rendering:**
   - **Expanded State (250px width):** Show logo + "NARAGI" text + labels for all menu items
   - **Collapsed State (80px width):** Show only icons, add tooltips via title attribute

5. **Header Section (Logo & Toggle Button):**
   - Logo/text wrapped in clickable button element (not static div)
   - Display Star icon + App name ("NARAGI") on left side
   - Render Chevron icon button on right side (CollapseIcon when expanded, ExpandIcon when collapsed)
   - Icons automatically swap based on isExpanded state
   - Logo button maintains flexbox layout with flex-1 + gap-3

6. **Navigation Menu Items:**
   - Render three main nav items via MenuItem component: Brain, Voice, Model
   - Model button shows active state when isModelActive === true
   - Pass isExpanded prop to control label visibility and button width
   - Each item has hover effect (bg-sidebar-accent)

7. **Bottom Menu Group:**
   - Theme toggle button: calls toggleTheme() on click, shows isActive state when soft-anime theme enabled
   - Settings button: placeholder for future functionality
   - Both respect isExpanded state for label visibility

8. **Styling & Animations:**
   - Container width transitions: 250px ↔ 80px (300ms duration)
   - Logo button: smooth transitions on hover (duration-200)
   - Menu items: justify-start (expanded) ↔ justify-center (collapsed)
   - Buttons show title tooltip on hover when collapsed
   - Responsive border and background colors via Tailwind dark mode classes

**Key Components:**
- **StarIcon, BrainIcon, VoiceIcon, ModelIcon, CollapseIcon, ExpandIcon, ThemeIcon, SettingIcon** - SVG icon components (pure React)
- **MenuItem** - Reusable button component with conditional label rendering based on isExpanded
- **Sidebar** - Main export component managing state and layout

**Props:**
- `className?: string` - Additional CSS classes to merge with root aside element
- `isModelActive?: boolean` - Indicates if 3D model view is active (controls Model button active state)
- `onModelToggle?: (state: boolean) => void` - Callback fired when Model button clicked; parent updates isModelActive state
- `onLogoClick?: () => void` - Callback fired when NARAGI logo/text clicked; parent returns to main chat interface

**State:**
- `isExpanded: boolean` - Controls sidebar width and label visibility (useState)
- `theme: string` - Current theme from useTheme hook
- `isSoftAnime: boolean` - Derived flag: theme === "soft-anime"

**Error Handling:** None required - all dynamic rendering is CSS-driven; optional callbacks (onModelToggle, onLogoClick) safe to omit

**Accessibility:**
- Logo button has title: "Return to main chat interface"
- Toggle button has aria-label: "Collapse sidebar" / "Expand sidebar"
- Menu items get title attributes when collapsed for screen reader support
- Focus rings visible on all interactive elements (focus-visible ring-2 ring-primary)
- Cursor pointer on logo hover indicates clickability (cursor-pointer)
- Semantic HTML5 with proper button elements

---

| Aspect | Standard | Implementation |
|--------|----------|-----------------|
| Component Separation | Single Responsibility | Sidebar handles layout + state; MenuItem handles button rendering |
| Props Naming | camelCase | `isExpanded`, `isSoftAnime`, `isActive`, `onLogoClick`, `onModelToggle` |
| Type Safety | Strict TypeScript | `SidebarProps` interface with optional callbacks |
| Documentation | Self-documenting + inline comments | Each section clearly commented, semantic HTML |
| State Management | React hooks (useState) | isExpanded state lifted to Sidebar component |
| Data Flow | Unidirectional | Callbacks flow up (onLogoClick, onModelToggle); props flow down |
| Responsive Design | Tailwind utilities | Width transitions, flex layout, hover effects, cursor indicators |
| Code Modularity | No function exceeds 50 lines | MenuItem ~15 lines, Sidebar ~70 lines |
| Accessibility | WCAG 2.1 standards | aria-labels, title attributes, focus rings, semantic HTML, cursor-pointer |
| Navigation Logic | SPA state-based switching | Logo click → parent callback → setIsModelActive(false) → main chat |

---

## 🎵 TIER 4: Frontend Audio Management - Prevent Overlapping Playback

### Component: useAudioManager Hook (frontend/hooks/use-audio-manager.ts)

**Name:** `useAudioManager` hook + `stopAllActiveAudio` function + audio registry

**Internal Dependencies:**
- `React` - `useRef`, `useCallback`, `useEffect` hooks
- Global `audioRegistry` Map - Persistent across re-renders

**Purpose:** Prevent overlapping Web Audio playback when switching between interface states (Model ON/OFF). Maintains a global registry of all active audio players and provides centralized control to stop all audio on demand.

**Problem Solved:**
- **Issue:** When toggling between 2D (Gemini Chat) and 3D (Model) interfaces, audio from the previous state continues playing while new audio starts, causing messy overlaps.
- **Root Cause:** Each interface uses independent `useAudioPlayer` hook instances with no coordination. State toggle swaps DOM but doesn't kill previous audio.
- **Solution:** Centralized registry that tracks all active audio and allows stopping all at once.

**Process Flow:**

1. **Audio Registry (Global State):**
   - Map structure: `audioRegistry = Map<playerId, stopFunction>`
   - Persists across component re-renders
   - Unique IDs generated via `Date.now() + counter`

2. **useAudioManager Hook Initialization:**
   - Returns three functions: `registerAudioPlayer`, `unregisterAudioPlayer`, `stopAllAudio`
   - `registerAudioPlayer(stopFunction)` adds audio player to registry, returns unique ID
   - `unregisterAudioPlayer(id)` removes audio player from registry (on unmount)
   - `stopAllAudio()` calls all registered stop functions, then clears registry

3. **Integration with useAudioPlayer:**
   - On mount: Calls `registerAudioPlayer()` with a stop handler that:
     - Stops AudioBufferSourceNode
     - Disconnects audio nodes from gain node
     - Sets state to "idle"
     - Cancels animation frame
     - Nullifies source reference
   - On unmount: Unregisters from audio manager to prevent orphaned entries

4. **Integration with AppLayout (State Toggle):**
   - When `isModelActive` state changes (via Model button or logo click):
     - Call `stopAllActiveAudio()` BEFORE state change
     - All audio players in registry stop simultaneously
     - Registry cleared
     - Then state is updated, switching interface
   - Result: Zero audio overlap, clean state transition

5. **Helper Functions:**
   - `stopAllActiveAudio()` - Public export for use in components (standalone function)
   - `getActiveAudioCount()` - Debugging: returns number of active audio players
   - `clearAudioRegistry()` - Emergency cleanup: clears registry without calling stop functions

**Key Data Structures:**
- `audioRegistry: Map<string, () => void>` - Maps player IDs to stop functions
- `registryCounter: number` - Global counter for unique ID generation
- `playerIdRef: RefObject<string>` - Stores player ID in each hook instance

**Error Handling:**
- Try-catch in `stopAllAudio()` catches errors in individual stop functions
- Continues processing remaining audio players even if one throws error
- Logged to console but doesn't break UI

**Performance Considerations:**
- Registry lookup: O(1) via Map
- Stopping all audio: O(n) where n = active audio players (typically 1-2)
- Memory: One small Map entry per active audio player (~40-50 bytes)

**Usage Example:**

```typescript
// In AppLayout or any component that triggers state changes:
import { stopAllActiveAudio } from "@/hooks/use-audio-manager";

const handleModelToggle = (newState: boolean) => {
  stopAllActiveAudio();  // Stop all audio from previous interface
  setIsModelActive(newState);  // Switch to new interface
};
```

**State Flow Diagram:**
```
User clicks "Model" button
    ↓
handleModelToggle(true) called
    ↓
stopAllActiveAudio() executes
    ├→ Iterates audioRegistry Map
    ├→ Calls each player's stop() function
    └→ Clears registry
    ↓
setIsModelActive(true) executes
    ↓
AppLayout re-renders with 3D interface visible
    ↓
New AudioPlayer instances register with fresh registry
```

---

## 🎵 TIER 2: Backend Audio Stream Management (useAudioPlayer Hook Enhancement)

### Component Enhancement: useAudioPlayer Hook (frontend/hooks/use-audio-player.ts)

**Name:** `useAudioPlayer` hook (UPDATED for audio registry integration)

**Updates from Previous Version:**
- **New:** Integrates with global audio manager via `useAudioManager` hook
- **New:** Registers stop function on mount
- **New:** Unregisters on unmount to prevent orphaned entries
- **Changed:** Cleanup effect now handles audio manager registration/unregistration

**Critical Change: Stop Function Registration**

When `useAudioPlayer` mounts:
1. Calls `registerAudioPlayer()` with a stop handler
2. Handler encapsulates the audio cleanup logic:
   - Stops `sourceRef.current` (AudioBufferSourceNode)
   - Disconnects audio nodes
   - Nullifies references
   - Cancels animation frame
   - Resets state to "idle"
3. Receives `playerIdRef` for tracking
4. On unmount: Unregisters `playerIdRef` from registry

**Result:**
- When `stopAllActiveAudio()` fires, all active audio players receive unified stop signal
- No audio orphans, no memory leaks, clean state transitions

---

| Aspect | Standard | Implementation |
|--------|----------|-----------------|
| Audio Coordination | Centralized registry | Global Map with unique IDs per player |
| State Management | Unidirectional data flow | Audio players register up, signals cascade down |
| Error Handling | Graceful degradation | Try-catch per player, continue if one fails |
| Performance | O(1) lookups, O(n) stop all | Map-based, minimal overhead |
| Memory Management | No leaks | Unregister on unmount, clear on state change |
| Testing | Unit testable | Registry exported, functions deterministic |
| Documentation | Self-documenting | Clear function names, inline comments |

---

**End of System Description Registry**
