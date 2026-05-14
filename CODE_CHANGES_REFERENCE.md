# Code Changes Reference - Tag Extraction Fix

## Summary of Changes

**Problem**: Tag extractor received plain text instead of XML
**Solution**: Parse XML once in `llm_service`, propagate all fields through schema

---

## File 1: llm_core/schemas.py

### Change: Add raw_output field to ModelResponseSchema

```python
# ADDED FIELD (line ~101)
raw_output: str = Field(
    default="",
    description="Raw LLM output with XML tags (preserved for debugging and re-processing)"
)
```

**Location in file**: After `sources` field, before `metadata` field

**Why**: Preserves original XML throughout pipeline for debugging and re-processing

---

## File 2: llm_core/llm_service.py

### Change 1: Add TagExtractor import

```python
# ADD THIS LINE (after line ~23)
from llm_core.utils.tag_extractor import TagExtractor
```

**Location**: With other imports from llm_core.utils

**Why**: Need TagExtractor to parse XML tags properly

---

### Change 2: Update Cache Hit Path (lines ~205-223)

**Before:**
```python
cached_response = cache_results[0]["response"]
display_text_clean, _ = extract_dual_track(cached_response)
return ModelResponseSchema(
    session_id=session_id,
    assistant_text=display_text_clean,
    sources=["cached_response"],
    metadata={
        "cache_hit": True,
        "latency_ms": int((time.time() - start_time) * 1000),
        "cache_similarity": cache_results[0]["score"]
    }
)
```

**After:**
```python
cached_response = cache_results[0]["response"]
# Parse cached XML response properly
extracted = TagExtractor.extract_tags(cached_response)
return ModelResponseSchema(
    session_id=session_id,
    assistant_text=extracted.display,
    html_content=extracted.html,
    voice_text=extracted.voice,
    intent_classification=extracted.intent,
    raw_output=cached_response,
    sources=["cached_response"],
    metadata={
        "cache_hit": True,
        "latency_ms": int((time.time() - start_time) * 1000),
        "cache_similarity": cache_results[0]["score"]
    }
)
```

**Key changes**:
- Use `TagExtractor.extract_tags()` instead of `extract_dual_track()`
- Populate all response fields: `html_content`, `voice_text`, `intent_classification`
- Add `raw_output` field

---

### Change 3: Update Main Response Path (lines ~265-296)

**Before:**
```python
if not final_response_text:
    logger.warning("No response generated from agent")
    return self._error_response(session_id, "Unable to generate response")

# Step 3: Extract display portion
assistant_text, voice_text = extract_dual_track(final_response_text)

# Step 4: Cache the response
if self.enable_cache:
    self.semantic_cache.save(
        query=user_text,
        response=final_response_text,
        intent="general"
    )
    logger.debug("Response cached for future reuse")

# Calculate latency
latency_ms = int((time.time() - start_time) * 1000)

logger.info(
    "Response generated successfully | Session: %s | Latency: %dms",
    session_id, latency_ms
)
                
# Step 5: Return formatted response
return ModelResponseSchema(
    session_id=session_id,
    assistant_text=assistant_text,
    sources=["grammar_guide", "vocabulary_db"],
    metadata={
        "cache_hit": False,
        "latency_ms": latency_ms,
        "iterations": iterations,
        "has_voice": bool(voice_text)
    }
)
```

**After:**
```python
if not final_response_text:
    logger.warning("No response generated from agent")
    return self._error_response(session_id, "Unable to generate response")

# Step 3: Parse XML tags from response
extracted = TagExtractor.extract_tags(final_response_text)

# Step 4: Cache the response
if self.enable_cache:
    self.semantic_cache.save(
        query=user_text,
        response=final_response_text,
        intent="general"
    )
    logger.debug("Response cached for future reuse")

# Calculate latency
latency_ms = int((time.time() - start_time) * 1000)

logger.info(
    "Response generated successfully | Session: %s | Latency: %dms",
    session_id, latency_ms
)
                
# Step 5: Return formatted response with all parsed fields
return ModelResponseSchema(
    session_id=session_id,
    assistant_text=extracted.display,
    html_content=extracted.html,
    voice_text=extracted.voice,
    intent_classification=extracted.intent,
    raw_output=final_response_text,
    sources=["grammar_guide", "vocabulary_db"],
    metadata={
        "cache_hit": False,
        "latency_ms": latency_ms,
        "iterations": iterations,
        "extraction_success": extracted.extraction_success
    }
)
```

**Key changes**:
- Replace `extract_dual_track()` with `TagExtractor.extract_tags()`
- Populate all fields from `extracted` object
- Add `raw_output` to preserve original XML
- Update metadata to include `extraction_success` flag

---

## File 3: backend/routers/chat.py

### Change: Simplify response handling - use pre-parsed data (lines ~49-74)

**Before:**
```python
# ========== STEP 3: Invoke SenseiAgent ==========
llm_output = agent.generate_response(llm_input)

logger.info(
    f"Agent response generated | ID: {message_id} | "
    f"Cache hit: {llm_output.metadata.get('cache_hit', False)} | "
    f"Latency: {llm_output.metadata.get('latency_ms', 0)}ms"
)

# ========== STEP 4: Format LLM output using OutputFormatter ==========
from llm_core.output_formatter import OutputFormatter

formatted_response = OutputFormatter.format_response(llm_output.assistant_text)

if not formatted_response.success:
    logger.warning(
        f"LLM output formatting failed: {formatted_response.error_details}"
    )
    display_text = "Sorry, an error occurred processing your request."
    voice_text = "エラーが発生しました。"
else:
    display_text = formatted_response.display_text
    voice_text = formatted_response.voice_text

logger.debug(
    f"Formatted response | Display: {len(display_text)} chars | "
    f"Voice: {len(voice_text)} chars"
)

# ========== STEP 5: Format as ChatMessageResponse ==========
```

**After:**
```python
# ========== STEP 3: Invoke SenseiAgent ==========
llm_output = agent.generate_response(llm_input)

logger.info(
    f"Agent response generated | ID: {message_id} | "
    f"Cache hit: {llm_output.metadata.get('cache_hit', False)} | "
    f"Latency: {llm_output.metadata.get('latency_ms', 0)}ms"
)

# ========== STEP 4: Use pre-parsed fields from ModelResponseSchema ==========
# All XML tags have been extracted in llm_service by TagExtractor
# No need for OutputFormatter here - data is already parsed and validated

display_text = llm_output.assistant_text
voice_text = llm_output.voice_text

if not display_text:
    logger.warning("Empty display text in agent response")
    display_text = "Sorry, an error occurred processing your request."
    voice_text = "エラーが発生しました。"

logger.debug(
    f"Using extracted response | Display: {len(display_text)} chars | "
    f"Voice: {len(voice_text)} chars"
)

# ========== STEP 5: Format as ChatMessageResponse ==========
```

**Key changes**:
- Remove `OutputFormatter.format_response()` call
- Use pre-parsed `llm_output.assistant_text` and `llm_output.voice_text` directly
- Add validation check for empty display text
- Update log message to reflect that data is already extracted

---

## Why These Changes Fix The Issue

### Data Flow Before (❌ Broken)
```
LLM Service
  ├─ final_response_text: <html>...</html><display>...</display>...
  ├─ extract_dual_track(final_response_text) ← Lost full XML here!
  └─ ModelResponseSchema(assistant_text="display only")
       ↓
     Router
       ├─ llm_output.assistant_text: "display only"
       └─ OutputFormatter.format_response(llm_output.assistant_text)
            ├─ TagExtractor.extract_tags("display only")
            └─ ❌ All regex patterns fail - no XML tags to find!
```

### Data Flow After (✓ Fixed)
```
LLM Service
  ├─ final_response_text: <html>...</html><display>...</display>...
  ├─ TagExtractor.extract_tags(final_response_text) ← Parse EVERYTHING
  └─ ModelResponseSchema(
       assistant_text=extracted.display,
       html_content=extracted.html,
       voice_text=extracted.voice,
       intent_classification=extracted.intent,
       raw_output=final_response_text          ← Full XML preserved!
     )
       ↓
     Router
       ├─ llm_output.assistant_text: "display only"
       ├─ llm_output.voice_text: "voice only"
       ├─ llm_output.intent_classification: "other"
       └─ No re-extraction needed - ✓ All data ready to use!
```

---

## Testing The Fix

### Test 1: Verify Schema Population
```python
# In llm_service after creating ModelResponseSchema:
assert llm_output.assistant_text, "Display text is empty"
assert llm_output.voice_text, "Voice text is empty"
assert llm_output.intent_classification, "Intent is empty"
assert llm_output.raw_output, "Raw output not preserved"
print("✓ All schema fields populated correctly")
```

### Test 2: Verify Raw Output Preserved
```python
# Check that raw XML is still there:
assert "<html>" in llm_output.raw_output, "HTML tag missing from raw"
assert "<display>" in llm_output.raw_output, "Display tag missing from raw"
assert "<voice>" in llm_output.raw_output, "Voice tag missing from raw"
assert "<intent>" in llm_output.raw_output, "Intent tag missing from raw"
print("✓ All XML tags preserved in raw_output")
```

### Test 3: End-to-End Flow
```python
# Send test message to router and verify response:
response = post_chat_message(ChatMessageRequest(
    user_id="test_user",
    session_id="test_session",
    message="hello",
    language="en"
))

assert response.status == "success"
assert response.message, "No display text returned"
assert response.voice_text, "No voice text returned"
print("✓ End-to-end flow working correctly")
```

---

## Rollback (If Needed)

If you need to revert these changes:

```bash
# Revert to previous version
git checkout HEAD -- llm_core/schemas.py
git checkout HEAD -- llm_core/llm_service.py
git checkout HEAD -- backend/routers/chat.py
```

Then restore the original `extract_dual_track()` and `OutputFormatter` usage.

---

## Impact Analysis

| Aspect | Before | After | Notes |
|--------|--------|-------|-------|
| **Performance** | 2 tag extractions | 1 tag extraction | ~50% faster tag extraction |
| **Code Complexity** | 3 layers of extraction | 1 clear extraction point | Easier to debug |
| **Data Loss Risk** | High (raw XML lost) | Low (raw XML preserved) | Better for future features |
| **Debugging** | Difficult (no raw data) | Easy (raw_output field) | Logs can include raw XML |
| **Maintenance** | Multiple extraction points | Single point of responsibility | Easier to maintain |

