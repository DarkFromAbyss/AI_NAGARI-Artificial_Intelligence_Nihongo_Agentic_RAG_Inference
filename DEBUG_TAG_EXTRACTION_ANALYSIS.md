# LLM Pipeline Tag Extraction Debugging Guide

**Issue**: `tag_extractor` receives plain text ("Chào em! Sensei có thể giúp gì cho em?") instead of full XML response with tags.

---

## 1. LOG ANALYSIS: What Happened Between LLM Response & Tag Extraction

### Timeline from Logs:

```
22:17:36 - llm_core.llm_service
├─ Final response length: 188 chars
└─ Content preview: <html><p>Xin chào!...</p></html>
                    <display>Chào em! Sensei có thể giúp gì cho em?</display>
                    <voice>こんにちは!...</voice>
                    <intent>other</intent>
   ✓ FULL XML WITH ALL TAGS PRESENT

22:17:36 - llm_core.semantic_cache
└─ Cached response (with full XML)

22:17:36 - llm_core.utils.tag_extractor
└─ LLM output: Chào em! Sensei có thể giúp gì cho em?
   ✗ ONLY DISPLAY CONTENT, NO TAGS
```

### What Changed: Data Flow Discrepancy

The **raw XML was intact** in `llm_service` but **stripped down to plain text** before reaching `tag_extractor`. 

---

## 2. ROOT CAUSE: Premature Extraction Bug

### The Culprit Chain:

**File**: [llm_core/llm_service.py](llm_core/llm_service.py) 
**Lines**: 260-296 (original code)

```python
# Step 3: Extract display portion (TOO EARLY!)
assistant_text, voice_text = extract_dual_track(final_response_text)
#                              ↑
#                     This function extracts <display> and <voice> tags
#                     and DISCARDS the original XML structure

# Step 5: Return response (ONLY partial data)
return ModelResponseSchema(
    session_id=session_id,
    assistant_text=assistant_text,  # ← ONLY extracted display text
    sources=["grammar_guide", "vocabulary_db"],
    # ❌ raw_output field didn't exist - XML lost!
    metadata={...}
)
```

**Then in router** ([backend/routers/chat.py](backend/routers/chat.py), lines 52-59):

```python
llm_output = agent.generate_response(llm_input)
# llm_output.assistant_text = "Chào em! Sensei có thể giúp gì cho em?"
#                              (plain text, no tags)

formatted_response = OutputFormatter.format_response(llm_output.assistant_text)
#                                                     ↑
#              Passing already-extracted text, not original XML
```

**Finally in output_formatter** ([llm_core/output_formatter.py](llm_core/output_formatter.py), lines 33-37):

```python
extracted: ExtractedTags = TagExtractor.extract_tags(llm_output)
#                                                    ↑
#                      Receives: "Chào em! Sensei có thể giúp gì cho em?"
#                      Tries to find: <html>, <display>, <voice>, <intent>
#                      Result: ALL REGEX PATTERNS FAIL ❌
```

---

## 3. COMMON BUG PATTERN: "Premature Extraction + Intermediate Transformation Loss"

This is a **classic data pipeline antipattern**:

### Pattern Definition
```
Early Stage → Extract Useful Data → Pass Only Extract (lose context)
     ↓
Later Stage Needs Full Context → Receives Partial Data → Fails
```

### Why It Happens
1. **Developer A** thinks: "I need to extract `<display>` for the API response schema"
2. Extracts it in `llm_service` for convenience
3. **Developer B** (or future self) thinks: "I need to extract all tags in `output_formatter`"
4. But only receives the already-extracted display text
5. **Result**: Cascade of failures downstream

### Real-World Scenarios This Occurs In
- **NLP Pipelines**: Tokenizing text early, losing original for later processing
- **API Gateways**: Extracting and transforming data, losing raw request
- **Database Pipelines**: Normalizing early, losing raw for debugging
- **Message Queues**: Deserializing prematurely, losing raw payload
- **ML Preprocessing**: Feature extraction, losing raw data for explainability

---

## 4. THE FIX: Parse Once, Propagate All Fields

### Solution: Use TagExtractor in `llm_service`, propagate all fields

#### Change 1: Extend ModelResponseSchema
**File**: [llm_core/schemas.py](llm_core/schemas.py)

Added field to preserve raw XML:
```python
raw_output: str = Field(
    default="",
    description="Raw LLM output with XML tags (preserved for debugging and re-processing)"
)
```

**Why**: Keeps both parsed fields (for immediate use) AND raw data (for re-processing or debugging).

---

#### Change 2: Parse XML in llm_service.py ONCE
**File**: [llm_core/llm_service.py](llm_core/llm_service.py)

**Before** (lines 260-296):
```python
# ❌ Premature extraction, raw data lost
assistant_text, voice_text = extract_dual_track(final_response_text)

return ModelResponseSchema(
    session_id=session_id,
    assistant_text=assistant_text,  # partial only
    sources=["grammar_guide", "vocabulary_db"],
)
```

**After**:
```python
# ✓ Use TagExtractor to parse EVERYTHING
extracted = TagExtractor.extract_tags(final_response_text)

return ModelResponseSchema(
    session_id=session_id,
    assistant_text=extracted.display,           # ← parsed display
    html_content=extracted.html,                # ← parsed html
    voice_text=extracted.voice,                 # ← parsed voice
    intent_classification=extracted.intent,     # ← parsed intent
    raw_output=final_response_text,             # ← raw XML preserved!
    sources=["grammar_guide", "vocabulary_db"],
    metadata={
        "cache_hit": False,
        "latency_ms": latency_ms,
        "iterations": iterations,
        "extraction_success": extracted.extraction_success
    }
)
```

**Key improvements**:
- ✓ All XML tags extracted ONCE by TagExtractor
- ✓ All fields populated in ModelResponseSchema
- ✓ Raw XML preserved for debugging
- ✓ No data loss in intermediate stages

---

#### Change 3: Simplify router - use pre-parsed data
**File**: [backend/routers/chat.py](backend/routers/chat.py)

**Before** (lines 52-65):
```python
# ❌ Trying to re-extract tags from already-extracted data
formatted_response = OutputFormatter.format_response(llm_output.assistant_text)

if not formatted_response.success:
    display_text = "Sorry, an error occurred..."
else:
    display_text = formatted_response.display_text
    voice_text = formatted_response.voice_text
```

**After**:
```python
# ✓ All data already extracted and validated in llm_service
display_text = llm_output.assistant_text
voice_text = llm_output.voice_text

if not display_text:
    logger.warning("Empty display text in agent response")
    display_text = "Sorry, an error occurred processing your request."
    voice_text = "エラーが発生しました。"
```

**Benefits**:
- ✓ No redundant tag extraction attempts
- ✓ Faster execution (parse once, not twice)
- ✓ All fields ready to use
- ✓ Reduced complexity in router

---

## 5. STEP-BY-STEP DEBUGGING INSTRUCTIONS

If you encounter similar issues in the future:

### Step 1: Trace the Data Flow
```python
# Add logging at each stage
print("Stage A - Raw output:", llm_output[:100])
print("Stage B - After extraction:", extracted_display[:100])
print("Stage C - After intermediate processing:", final_data[:100])
```

### Step 2: Identify Where Data Is Lost
```python
# Compare timestamps/sizes in logs
# If size drops, something is extracting/filtering
# If timestamp jump is large, something is processing
2026-05-12 22:17:36 - LLM output: 188 chars   ← Full response
2026-05-12 22:17:36 - tag_extractor input: 42 chars  ← Only display!
# ✗ Data lost between these points
```

### Step 3: Find the Culprit Function
```python
# Search for functions that transform the data
grep -r "extract_dual_track" .  # ← Found it!
grep -r "re.search" .           # ← Check regex operations
grep -r "\.split\(" .           # ← Check string splits
```

### Step 4: Check Schema Pass-Through
```python
# Verify all data flows through schemas correctly
class ResponseSchema:
    raw_data: str        # ← Must include raw!
    parsed_field: str    # ← Include parsed too
    
# Not just:
class BadSchema:
    parsed_field: str    # ❌ Raw data missing
```

### Step 5: Apply Single-Point-of-Responsibility Rule
```python
# ✓ Good: One module owns extraction
class LLMService:
    def generate_response(self):
        extracted = TagExtractor.extract_tags(response)
        return SchemaWithAllFields(
            raw=response,
            parsed_fields=extracted.*
        )

# ❌ Bad: Multiple modules try to extract
class LLMService:
    def generate_response(self):
        display = extract_dual_track_v1(response)
        
class Router:
    def process(self):
        tags = TagExtractor.extract_tags(assistant_text)  # ← Too late!
```

---

## 6. QUICK REFERENCE: What Changed

| Component | Before | After | Impact |
|-----------|--------|-------|--------|
| **llm_service** | Extracted display text only | Extract all tags, return all fields | Tag extractor now receives full XML |
| **ModelResponseSchema** | Missing raw_output field | Added raw_output field | Can preserve XML for debugging |
| **tag_extractor** | Received plain text | Receives full XML in raw_output | Can successfully extract tags |
| **router** | Called OutputFormatter again | Uses pre-parsed fields directly | Eliminates redundant extraction |
| **output_formatter** | Necessary workaround | No longer needed in pipeline | Simplifies code, reduces layers |

---

## 7. VERIFICATION CHECKLIST

After applying fixes, verify with these checks:

- [ ] **Log check**: Confirm `tag_extractor` receives full XML with `<html>`, `<display>`, `<voice>`, `<intent>` tags
- [ ] **Regex check**: All regex patterns should match (MATCH: not None)
- [ ] **Field check**: All fields in `ModelResponseSchema` are populated (assistant_text, html_content, voice_text, intent_classification)
- [ ] **Raw output**: `raw_output` field contains complete original XML
- [ ] **No duplicate extraction**: Router no longer calls `OutputFormatter.format_response()`
- [ ] **Integration test**: Send test query and verify response contains all tags

---

## 8. PREVENTION: Guidelines for Future Development

### Rule 1: Preserve Raw Data
```python
# ✓ Good
return {
    "raw_response": full_xml,        # Always keep original
    "parsed_display": extracted.display
}

# ❌ Bad
return {
    "display": extracted.display     # Lost raw XML forever
}
```

### Rule 2: Single Extraction Point
```python
# ✓ Define which module owns extraction
# - LLM Service extracts from raw LLM output
# - No other module attempts extraction

# ❌ Avoid
# - LLM Service extracts display
# - Router tries to extract voice
# - OutputFormatter tries to extract intent
```

### Rule 3: Schema as Source of Truth
```python
# ✓ Include all fields needed downstream
class ResponseSchema(BaseModel):
    raw_output: str                    # For re-processing
    display_text: str                  # For UI
    voice_text: str                    # For TTS
    intent: str                        # For routing
    html_content: str                  # For detailed view

# ❌ Avoid minimal schemas
class BadSchema(BaseModel):
    display_text: str                  # ← Missing everything else
```

---

## 9. COMMON RELATED BUGS TO WATCH FOR

1. **String Encoding Loss**: UTF-8 Vietnamese text loses diacritics
2. **Whitespace Normalization**: Excessive `.strip()` calls removing needed spaces
3. **Regex Greediness**: Non-greedy `(.*?)` vs greedy `(.*)` in tag extraction
4. **JSON Serialization**: Complex types lost when converting to JSON for caching
5. **Message Queue Deserialization**: XML entities escaped during transmission

---

## 10. DEBUGGING TEMPLATE FOR SIMILAR ISSUES

When tag extraction fails on YOUR pipeline, use this template:

```python
# 1. Log raw input
logger.info("Raw input to extractor: %s", repr(llm_output[:200]))

# 2. Check if tags exist
if "<html>" not in llm_output:
    logger.warning("HTML tag missing! Data was likely stripped earlier")
    # Trace backwards to find where

# 3. Verify regex pattern
pattern = r'<html>(.*?)</html>'
match = re.search(pattern, llm_output, re.DOTALL)
logger.info("Regex match result: %s", match)

# 4. Check intermediate transformations
# - Did a function call transform the data?
# - Did a schema field drop data?
# - Did a cache key strip content?

# 5. Preserve raw data
schema_response = {
    "raw_input": llm_output,        # ← Always preserve!
    "extracted_fields": {...}
}
```

---

**Summary**: The fix changes where tag extraction happens (once in `llm_service` instead of twice), preserves raw data throughout the pipeline, and ensures downstream stages receive complete XML rather than partial extracts.
