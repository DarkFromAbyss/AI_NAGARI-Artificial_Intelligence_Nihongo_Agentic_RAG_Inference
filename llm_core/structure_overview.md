# LLM Core Module - Architecture Overview

**Author:** Senior AI Backend Engineer  
**Date:** May 2026  
**Status:** Production-Ready Implementation

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Module Structure](#module-structure)
3. [Component Breakdown](#component-breakdown)
4. [Data Flow](#data-flow)
5. [Integration Points](#integration-points)
6. [Error Handling & Resilience](#error-handling--resilience)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                         │
│                                                                  │
│  [Chat Panel] → POST /api/chat with ChatMessageRequest         │
└─────────────────────┬──────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                             │
│                                                                  │
│  [Router: chat.py]                                             │
│  - Receives ChatMessageRequest {message, user_id, session_id} │
│  - Calls llm_core.generate_response()                         │
│  - Formats response for frontend                              │
└─────────────────────┬──────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   LLM CORE MODULE (Python)                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SenseiAgent (Main Orchestrator)                        │   │
│  │  - Routes queries to appropriate components             │   │
│  │  - Manages LangGraph agent state                        │   │
│  │  - Validates input/output with Pydantic schemas        │   │
│  └─────────────────────────────────────────────────────────┘   │
│              ▲         ▲              ▲                         │
│              │         │              │                         │
│    ┌─────────┼────┐    │              │                         │
│    │         │    │    │              │                         │
│    ▼         ▼    ▼    ▼              ▼                         │
│  [Cache]  [Tools]  [Agent] [Retrieval] [LLM]                   │
│                                                                  │
└─────────────────────┬──────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                EXTERNAL SERVICES & DATA                         │
│                                                                  │
│  - Google Gemini API (LLM inference)                           │
│  - FAISS Vector Database (Semantic retrieval)                  │
│  - CSV Data (Vocabulary, Grammar)                              │
│  - Markdown Files (System prompts, rules)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Structure

### Directory Layout

```
llm_core/
├── __init__.py                    # Package initialization and exports
├── llm_service.py                 # Main orchestrator (SenseiAgent class)
├── schemas.py                     # Pydantic models for data contracts
├── semantic_cache.py              # Semantic caching layer with embeddings
│
├── agents/                        # LangGraph agent implementations
│   ├── __init__.py
│   ├── naragi_agent.py           # Main agentic RAG orchestrator
│   ├── state_definitions.py      # Agent state TypedDict definitions
│   └── tool_handlers.py          # Tool executor nodes
│
├── chains/                        # LangChain chain components
│   ├── __init__.py
│   ├── retrieval_chain.py        # Hybrid retrieval (BM25 + FAISS)
│   └── prompt_templates.py       # System prompts and templates
│
├── prompts/                       # Prompt management
│   ├── __init__.py
│   ├── system_prompts.py         # Base system instructions
│   └── prompt_loader.py          # Load from brain/ directory
│
└── utils/                         # Utility functions
    ├── __init__.py
    ├── text_normalizer.py        # Kanji normalization, Unicode handling
    ├── data_loaders.py           # CSV and vector DB loading
    ├── config_manager.py         # Configuration file handling
    └── logger.py                 # Centralized logging
```

---

## Component Breakdown

### 1. **schemas.py** - Data Contracts

**Purpose:** Define strict input/output interfaces between backend and llm_core.

**Classes:**

#### `MessageInputSchema` (Pydantic BaseModel)
- **Purpose:** Validate incoming requests from backend
- **Fields:**
  - `session_id: str` - Unique conversation identifier
  - `user_text: str` - Raw user query (1-2000 chars)
  - `user_id: Optional[str]` - User identifier for personalization
  - `language: str = "en"` - Output language ("en", "vi")
  - `metadata: Optional[dict]` - Additional context (mood, JLPT level, etc.)
- **Validation:**
  - `user_text` must be non-empty after stripping
  - `language` must be one of predefined values
  - Pydantic will auto-raise 422 for invalid data

#### `ModelResponseSchema` (Pydantic BaseModel)
- **Purpose:** Standardize responses returned to backend
- **Fields:**
  - `session_id: str` - Echo back session ID for tracking
  - `assistant_text: str` - Generated response with <display> tags
  - `sources: List[str]` - Retrieved documents used in reasoning
  - `metadata: Optional[dict]` - Latency, token usage, cache hit info
- **Note:** Does NOT include <voice> tag; backend handles TTS separately

---

### 2. **llm_service.py** - Main Orchestrator

**Purpose:** Facade pattern exposing a single entry point for backend integration.

**Class:** `SenseiAgent`

#### Constructor
```python
def __init__(
    self,
    config_path: str = "config.yaml",
    enable_cache: bool = True,
    api_key: Optional[str] = None
) -> None:
```
- Loads configuration from `config.yaml`
- Initializes LLM (Google Gemini)
- Loads data (vocabulary, grammar, FAISS, prompts)
- Initializes semantic cache with embeddings

#### Main Method: `generate_response()`
```python
def generate_response(
    self,
    message_input: MessageInputSchema,
    max_retries: int = 3
) -> ModelResponseSchema:
```

**Process Flow:**
1. **Input Validation:** Pydantic auto-validates `message_input`
2. **Cache Check:** Query semantic cache for similar past questions
3. **Cache Hit Path:** If found with confidence > 0.85, return cached response with `cache_hit: true` metadata
4. **Cache Miss Path:**
   - Invoke LangGraph agent with user query
   - Agent routes to appropriate tools (vocabulary, grammar, RAG)
   - LLM processes retrieved context
   - Return response with `cache_hit: false`
5. **Output Formatting:** Extract <display> portion, cache response
6. **Error Handling:** Catch exceptions, log with full traceback, return graceful error message

**Return:** `ModelResponseSchema` with assistant response and metadata

---

### 3. **semantic_cache.py** - Caching Layer

**Purpose:** Reduce latency and API costs by reusing responses for similar queries.

**Class:** `SenseiSemanticCache`

#### Key Methods

**`__init__(...)`**
- Load or initialize FAISS index with embeddings
- Path: `data/faiss/` (pre-built from vocabulary/grammar)

**`search(query_text: str, top_k: int = 5) -> List[Dict]`**
- Embed query using HuggingFace embeddings
- Search FAISS for similar past queries
- Return top-k matches with similarity scores
- **Threshold:** Only return results with cosine similarity > 0.75

**`save(query: str, response: str, intent: str) -> None`**
- After successful agent response, cache it for future reuse
- Store: (query_embedding, response, timestamp, intent)
- Metadata tracks when cached (for potential expiration logic)

**`clear()`**
- Flush cache (useful for testing, not typical production use)

---

### 4. **agents/naragi_agent.py** - LangGraph Orchestration

**Purpose:** Implement the agentic RAG loop using LangGraph for multi-turn reasoning.

**Core Components:**

#### State Definition (TypedDict)
```python
class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    display_lang: str          # "en" or "vi"
    retrieved_documents: list  # Context from retrieval tools
    reasoning_step: int        # Current iteration (1-5)
```

#### Agent Nodes

**1. Router Node** - Determines intent and routes to appropriate tool
- **Input:** User message
- **Logic:** Classify query type (vocab search, grammar question, multi-hop reasoning, out-of-scope)
- **Output:** Decision to invoke specific tool or invoke multiple tools

**2. Tool Executor Nodes**
- **`execute_vocab_search`**: Call `search_vocabulary()` tool
- **`execute_grammar_search`**: Call `search_grammar()` tool
- **`execute_rag_retrieval`**: Call `search_grammar_doc()` for hybrid search

**3. Reasoning Node** - LLM processes context and generates response
- **Input:** Original query + retrieved documents
- **Logic:** Use LLM to synthesize response from context
- **Output:** Draft response with reasoning metadata

**4. Grade & Reflect Node** - Self-evaluation
- **Input:** Draft response + original documents
- **Logic:** Check for hallucinations, verify factual grounding
- **Output:** Accept response or trigger re-retrieval

#### Graph Structure
```
START → Router → {Tool A, Tool B, Tool C} → Retrieval → Reasoning → Grade → END
                                                            ↑            │
                                                            └────────────┘ (retry loop, max 3)
```

---

### 5. **chains/retrieval_chain.py** - Hybrid Search

**Purpose:** Combine semantic search (FAISS) with keyword search (BM25) for robust retrieval.

**Class:** `HybridRetrieverChain`

#### Initialization
- Load FAISS vector store with embeddings
- Load all documents into BM25 retriever
- Set retrieval weights: FAISS=0.6, BM25=0.4 (tunable)

#### Retrieval Process
1. **Parallel Search:** Execute FAISS and BM25 simultaneously
2. **Score Combination:** Weighted linear combination of both scores
3. **Deduplication:** Remove duplicate documents
4. **Ranking:** Sort by combined score, return top-k
5. **Grading:** Optional: Use cross-encoder to re-rank results

#### Safety Threshold
- L2 distance threshold: 1.2 (for FAISS similarity)
- If all results exceed threshold, return empty (no hallucination)

---

### 6. **prompts/system_prompts.py** - System Instructions

**Purpose:** Load and manage system prompts from markdown files in `brain/7B/`.

#### Files Loaded
1. **intro.md** - Introduction and role definition for Sensei persona
2. **context.md** - Knowledge domain and teaching methodology
3. **rules.md** - Output format constraints, dual-track format

#### Prompt Assembly
```
BASE_SYSTEM_PROMPT = f"""
{INTRO_CONTENT}

{CONTEXT_CONTENT}

{RULES_CONTENT}

[SYSTEM SETTINGS]
- Output language: {display_lang}
- Max reasoning steps: 3
- Safety guardrails enabled
"""
```

---

### 7. **utils/** - Utility Functions

#### `text_normalizer.py`
- **`normalize_text_input(text: str) -> str`**: Standardize user input (Unicode NFKC, Kanji variants)
- **`extract_dual_track(response: str) -> Tuple[str, str]`**: Parse <display> and <voice> tags

#### `data_loaders.py`
- **`load_vocabulary_csv(path: str) -> DataFrame`**: Load vocab data with error handling
- **`load_grammar_csv(path: str) -> DataFrame`**: Load grammar patterns
- **`load_faiss_index(path: str) -> FAISS`**: Initialize vector store with allow_dangerous_deserialization=True

#### `config_manager.py`
- **`load_config(config_path: str) -> Dict`**: Parse YAML config safely
- **`get_model_path(config, model_name) -> str`**: Resolve model paths cross-platform

#### `logger.py`
- **`get_logger(name: str) -> logging.Logger`**: Return configured logger with:
  - Format: `"%(asctime)s - %(name)s - %(levelname)s - %(message)s"`
  - Level: INFO (from config or environment)
  - No print() statements anywhere

---

## Data Flow

### Request Flow (Backend → llm_core)

```
1. Frontend sends: POST /api/chat
   {
     "message": "高校とは何ですか？",
     "user_id": "student_001",
     "session_id": "conv_12345",
     "language": "ja"
   }

2. Backend validates with ChatMessageRequest schema

3. Backend calls:
   llm_core.generate_response(
     MessageInputSchema(
       user_text="高校とは何ですか？",
       user_id="student_001",
       session_id="conv_12345",
       language="ja"
     )
   )

4. llm_core processes and returns:
   {
     "session_id": "conv_12345",
     "assistant_text": "<display>高校 means senior high school (grades 10-12)...</display>",
     "sources": ["vocabulary_db:高校", "grammar_doc:school_hierarchy"],
     "metadata": {
       "cache_hit": false,
       "latency_ms": 3200,
       "tokens_used": 450
     }
   }

5. Backend extracts assistant_text, formats for frontend
```

### Internal LLM Core Flow

```
User Query ("高校とは何ですか？")
    ↓
[Cache Check]
    ├─→ Cache Hit (similarity > 0.75) → Return cached response
    └─→ Cache Miss → Continue
    ↓
[Semantic Router]
    ├─→ Vocab Search Intent (80% confidence)
    └─→ Invoke search_vocabulary("高校")
    ↓
[Tool Execution]
    ├─→ search_vocabulary returns: level, reading, meaning, examples
    └─→ Store in retrieved_documents
    ↓
[LLM Reasoning]
    ├─→ Assemble prompt: system_instructions + context + query
    ├─→ Call Google Gemini API
    └─→ Generate response with <display>...</display> format
    ↓
[Self-Grading]
    ├─→ Check: Is response grounded in retrieved documents?
    ├─→ Check: No hallucinations?
    └─→ If pass: Return response; If fail: Retry retrieval (max 3 times)
    ↓
[Cache Storage]
    └─→ Embed query, store (query_embedding, response, metadata)
    ↓
Return ModelResponseSchema
```

---

## Integration Points

### 1. Backend Integration (`backend/routers/chat.py`)

**Expected Call:**
```python
from llm_core import SenseiAgent
from llm_core.schemas import MessageInputSchema, ModelResponseSchema

# Initialize once at startup
agent = SenseiAgent(config_path="config.yaml")

# In route handler:
@router.post("/api/chat")
async def post_chat_message(request: ChatMessageRequest) -> ChatMessageResponse:
    try:
        # Convert backend schema to llm_core schema
        llm_input = MessageInputSchema(
            session_id=request.session_id or "default",
            user_text=request.message,
            user_id=request.user_id,
            language=request.language
        )
        
        # Get llm_core response
        llm_output = agent.generate_response(llm_input)
        
        # Extract and format for frontend
        return ChatMessageResponse(
            status="success",
            message=llm_output.assistant_text,
            message_id=generate_uuid(),
            timestamp=datetime.now(),
            metadata=llm_output.metadata
        )
    except Exception as e:
        logger.error("LLM Core error: %s", e, exc_info=True)
        return ChatMessageResponse(
            status="error",
            message="Unable to process your request.",
            message_id=generate_uuid(),
            timestamp=datetime.now()
        )
```

### 2. Frontend Expectations

**Display Format:** Backend extracts `<display>` portion from `llm_output.assistant_text`
```
Input: "<display>日本語のテキスト</display><voice>にほんご</voice>"
Display to user: "日本語のテキスト"
```

**Voice Processing:** Backend (or separate service) handles TTS:
```
Extract <voice> tag → Call Voicevox API → Stream audio to frontend
```

### 3. External Service Dependencies

| Service | Purpose | Fallback |
|---------|---------|----------|
| Google Gemini API | LLM inference | Return cached response if API fails |
| FAISS Vector DB | Semantic search | Fall back to BM25 keyword search |
| HuggingFace Embeddings | Text embedding | Use pre-computed embeddings from cache |
| CSV Data Files | Vocabulary/Grammar | Return "Data not available" error |

---

## Error Handling & Resilience

### Error Handling Strategy (rules.md Compliant)

**Principle:** Never expose internal errors to user. Map to business-level messages.

### Error Categories & Responses

| Error Type | Internal Handling | User Message |
|-----------|-------------------|--------------|
| Invalid input (422) | Log WARNING | "Please provide a valid question" |
| API timeout (>15s) | Log ERROR, retry once | "Processing took too long, try again" |
| Empty retrieval | Log DEBUG | "No matching resources found" |
| LLM API failure | Log ERROR, use cache | "Currently unavailable, try again" |
| Database corruption | Log CRITICAL | "System maintenance in progress" |

### Retry Logic

- **Retrieval Retry:** Max 3 attempts if grading fails
- **API Retry:** Max 2 attempts with exponential backoff (base 2s)
- **Cache Fallback:** Always attempt to return cached similar response if API fails

### Logging Standards (rules.md)

**Levels Used:**
- `DEBUG`: Detailed flow (cache hit/miss, tool selection)
- `INFO`: Request received, response generated
- `WARNING`: Validation issues, near-threshold confidence
- `ERROR`: API failures, retrieval empty, LLM errors
- `CRITICAL`: Initialization failures

**Format:** `"%(asctime)s - %(name)s - %(levelname)s - %(message)s"`

**Example:**
```python
logger.info("Chat message received | Session: %s | User: %s | Query: %s...", 
            session_id, user_id, user_text[:100])
logger.debug("Cache check for query embedding: %s", cache_hit)
logger.warning("Retrieved documents below confidence threshold: %.2f", score)
```

---

## Performance Characteristics

| Operation | Expected Latency | Notes |
|-----------|------------------|-------|
| Cache hit | 50-100ms | Fast embedding lookup + response format |
| Simple lookup (vocab) | 1-2s | Tool execution + LLM synthesis |
| Complex query (RAG) | 3-5s | Hybrid retrieval + multi-step reasoning |
| Agent retry (max 3) | 5-8s | Worst case: failed grading loops |
| API timeout threshold | 15s | Return cached response if exceeded |

---

## Compliance with rules.md

✅ **No print() statements** - All logging via logger module  
✅ **Strict typing** - Type hints on all functions, Pydantic validation  
✅ **DRY principle** - Shared utility functions in utils/  
✅ **Modular functions** - Each function <50 lines  
✅ **Separation of concerns** - Agents, chains, prompts, utils isolated  
✅ **Stateless design** - Session state passed as parameters  
✅ **API-first** - Schema-driven contracts  
✅ **Self-documenting** - Function names, docstrings, comments for "why"  
✅ **Centralized config** - config.yaml loaded once at startup  
✅ **Centralized logging** - logger.py provides consistent format

