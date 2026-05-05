# AI NARAGI Backend Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Directory Structure](#directory-structure)
3. [Component Breakdown](#component-breakdown)
4. [Setup & Installation](#setup--installation)
5. [Running the Backend](#running-the-backend)
6. [API Reference](#api-reference)
7. [Integration with Frontend](#integration-with-frontend)

---

## Project Overview

### Introduction

The AI NARAGI Backend is a production-grade FastAPI service designed to handle chat messages from the frontend application. It receives user messages, processes them, and coordinates with the LLM backend for intelligent responses.

### Core Technology Stack

- **Framework:** FastAPI 0.104.1 (async web framework)
- **ASGI Server:** Uvicorn 0.24.0 (high-performance HTTP server)
- **Data Validation:** Pydantic 2.5.0 (strict input validation)
- **Language:** Python 3.9+
- **Architecture:** Modular, layered design with separation of concerns

### Architectural Principles

The backend adheres to senior-level engineering standards:

- **Modularization:** Code separated by concern (config, logging, schemas, routers)
- **Structured Logging:** Centralized logging with no `print()` statements
- **Strict Validation:** Pydantic schemas validate all incoming requests
- **Exception Handling:** Comprehensive error handling with user-friendly responses
- **Stateless Design:** Enables horizontal scaling and easier deployment
- **API-First:** Clear contracts between frontend and backend via OpenAPI

---

## Directory Structure

```
backend/
│
├── main.py                      # Application factory and startup
├── requirements.txt             # Python dependencies
├── .env                         # Environment variables (optional)
│
├── core/                        # Core configuration and utilities
│   ├── __init__.py
│   ├── config.py               # Application settings
│   └── logger.py               # Centralized logging setup
│
├── routers/                     # API endpoint implementations
│   ├── __init__.py
│   └── chat.py                 # Chat message endpoint logic
│
└── schemas/                     # Pydantic data validation models
    ├── __init__.py
    └── chat_schema.py          # Chat request/response schemas
```

---

## Component Breakdown

### `main.py` - Application Factory

**Purpose:** 
Initializes and configures the FastAPI application, setting up middleware, exception handlers, and route registration.

**Responsibilities:**
- Create FastAPI application instance
- Configure CORS middleware for frontend integration
- Register exception handlers for graceful error responses
- Include routers from submodules
- Manage application lifespan (startup/shutdown events)

**Key Functions:**
- `create_app()` - Factory function that creates and configures the app
- Exception handlers for validation (422) and server errors (500)
- Lifespan context manager for logging startup/shutdown events

**Dependencies:**
- FastAPI, CORSMiddleware
- `config`, `logger`, `routers.chat`

**Integration with Frontend:**
- CORS enabled for `http://localhost:3000` (Next.js dev server)
- Supports credentials and standard HTTP methods

---

### `core/config.py` - Configuration Management

**Purpose:**
Centralizes all environment-based and static configuration to ensure consistency and enable deployment across development, staging, and production environments.

**Key Settings:**
- `app_name` - "AI NARAGI Chat API"
- `app_version` - Version identifier
- `debug` - Debug mode flag
- `server_host` - Server bind address (default: 127.0.0.1)
- `server_port` - Server port (default: 8000)
- `cors_origins` - List of allowed frontend origins
- `log_level` - Logging verbosity (INFO, DEBUG, etc.)

**Configuration Source:**
- Loads from `.env` file if present
- Environment variables override defaults
- Uses Pydantic `BaseSettings` for type-safe configuration

**CORS Origins (Default):**
- `http://localhost:3000` - Next.js development
- `http://127.0.0.1:3000` - Alternative localhost format
- `http://localhost:5173` - Vite development (alternative)
- `http://127.0.0.1:5173` - Vite alternative format

**Usage:**
```python
from core.config import settings

# Access configuration throughout application
print(settings.app_name)
print(settings.cors_origins)
```

---

### `core/logger.py` - Logging Infrastructure

**Purpose:**
Provides centralized, standardized logging throughout the application to ensure consistent output and aid in debugging.

**Key Function:**
- `get_logger(name)` - Returns a configured logger instance

**Features:**
- Formats logs with timestamp, logger name, level, and message
- Outputs to stdout for container/deployment compatibility
- Level set from configuration (default: INFO)
- Supports full traceback logging with `exc_info=True`

**Log Format:**
```
2026-05-04 10:30:45 - naragi_backend - INFO - Chat message received | ID: msg_abc123 | User: user_123
```

**Usage:**
```python
from core.logger import get_logger

logger = get_logger(__name__)
logger.info("Application started")
logger.error("An error occurred", exc_info=True)
```

**STRICT RULE:** No `print()` statements anywhere in the codebase. All output must use the logger.

---

### `schemas/chat_schema.py` - Data Validation Models

**Purpose:**
Defines Pydantic models for strict validation of incoming and outgoing data, preventing malformed requests from reaching business logic.

**Models:**

#### `ChatMessageRequest`
Validates incoming chat messages from the frontend.

**Fields:**
- `message` (str, required): User's chat message (1-2000 characters)
- `user_id` (str, optional): Identifier for the user
- `session_id` (str, optional): Identifier for the conversation session
- `language` (str, optional): ISO 639-1 language code (default: "en")

**Validation:**
- Message must be 1-2000 characters
- Auto-strips whitespace
- Rejects empty or whitespace-only messages

**Example:**
```json
{
  "message": "こんにちは、日本語を勉強しています。",
  "user_id": "user_123",
  "session_id": "session_abc",
  "language": "ja"
}
```

#### `ChatMessageResponse`
Standardizes successful responses to the frontend.

**Fields:**
- `status` (str): "success" or "error"
- `message` (str): Human-readable response message
- `message_id` (str): Unique identifier for the processed message
- `timestamp` (datetime): ISO 8601 timestamp of processing

**Example:**
```json
{
  "status": "success",
  "message": "Message received and queued for processing",
  "message_id": "msg_abc123def456",
  "timestamp": "2026-05-04T10:30:45.123456"
}
```

#### `ErrorResponse`
Standardizes error responses to prevent information leakage.

**Fields:**
- `status` (str): Always "error"
- `message` (str): Error message for the user
- `detail` (str, optional): Additional error context

---

### `routers/chat.py` - Chat Endpoint Implementation

**Purpose:**
Implements the primary `/api/chat` endpoint that receives messages from the frontend, logs them, and queues them for processing.

**Endpoints:**

#### `POST /api/chat`
**Route:** `POST /api/chat`
**Status Code:** 200 OK (success) or 422 (validation error) or 500 (server error)

**Request:**
```json
{
  "message": "User's message here",
  "user_id": "optional_user_id",
  "session_id": "optional_session_id",
  "language": "en"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "message": "Message received and queued for processing",
  "message_id": "msg_abc123",
  "timestamp": "2026-05-04T10:30:45.123456"
}
```

**Error Responses:**

**422 Validation Error:**
```json
{
  "status": "error",
  "message": "Request validation failed",
  "detail": "Message must be between 1 and 2000 characters"
}
```

**500 Server Error:**
```json
{
  "status": "error",
  "message": "Internal server error",
  "detail": "An unexpected error occurred. Please try again."
}
```

**Function: `post_chat_message()`**
- Generates unique message ID for tracking
- Logs incoming message with context (user, session, language)
- Returns standardized response with message_id and timestamp
- Catches validation errors and logs with WARNING level
- Catches unexpected errors and logs with ERROR level + full traceback
- Returns 500 error to client without exposing internal details

**Key Features:**
- UUID-based message ID generation for tracking
- Detailed logging with context (user, session, language)
- Message preview in logs (first 100 characters)
- Graceful error handling with user-friendly messages
- try-except-catch pattern for robust error handling

#### `GET /api/health`
**Route:** `GET /api/health`
**Status Code:** 200 OK

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-04T10:30:45.123456"
}
```

**Purpose:** Health check for monitoring and load balancers to verify API availability.

---

## Setup & Installation

### Prerequisites

Before setting up the backend, ensure you have:

- **Python:** Version 3.9 or higher
- **pip:** Python package manager
- **Virtual Environment Tool:** `venv` (built-in) or `conda`

### Step 1: Create Virtual Environment

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

**Packages Installed:**
- `fastapi==0.104.1` - Web framework
- `uvicorn==0.24.0` - ASGI server
- `pydantic==2.5.0` - Data validation
- `pydantic-settings==2.1.0` - Configuration management
- `python-multipart==0.0.6` - Form data handling
- `python-dotenv==1.0.0` - Environment variable loading

### Step 3: Configure Environment (Optional)

Create a `.env` file in the `backend/` directory to override defaults:

```env
# .env
DEBUG=false
LOG_LEVEL=INFO
SERVER_HOST=127.0.0.1
SERVER_PORT=8000
```

If `.env` is not created, the application uses default settings from `core/config.py`.

---

## Running the Backend

### Development Mode (with Auto-Reload)

```bash
# From backend directory
python main.py
```

**Expected Output:**
```
2026-05-04 10:30:45 - naragi_backend - INFO - Starting AI NARAGI Chat API v1.0.0
2026-05-04 10:30:45 - naragi_backend - INFO - CORS enabled for origins: ['http://localhost:3000', ...]
2026-05-04 10:30:45 - naragi_backend - INFO - FastAPI application created and configured successfully
2026-05-04 10:30:45 - naragi_backend - INFO - Starting Uvicorn server on 127.0.0.1:8000
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
```

**Auto-reload:** Server automatically restarts when source files change (useful for development).

### Production Mode (without Auto-Reload)

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Key Options:**
- `--host 0.0.0.0` - Bind to all network interfaces
- `--port 8000` - Server port
- `--workers 4` - Number of worker processes for concurrency

### Accessing the Backend

Once running:
- **Base URL:** `http://localhost:8000`
- **Interactive API Documentation:** `http://localhost:8000/docs` (Swagger UI)
- **Alternative Documentation:** `http://localhost:8000/redoc` (ReDoc)
- **Health Check:** `http://localhost:8000/api/health`

---

## API Reference

### Overview

The backend exposes a RESTful API with the following endpoints:

| Method | Endpoint | Purpose | Status Codes |
|--------|----------|---------|--------------|
| POST | `/api/chat` | Send and process chat message | 200, 422, 500 |
| GET | `/api/health` | Health check | 200 |

### POST /api/chat

**Purpose:** Process a user's chat message from the frontend.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Hello, how are you?",
  "user_id": "user_123",
  "session_id": "session_abc",
  "language": "en"
}
```

**Request Field Validation:**
- `message`: Required, 1-2000 characters, cannot be empty/whitespace-only
- `user_id`: Optional string
- `session_id`: Optional string
- `language`: Optional, defaults to "en"

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Message received and queued for processing",
  "message_id": "msg_abc123",
  "timestamp": "2026-05-04T10:30:45.123456"
}
```

**Validation Error (422):**
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "message"],
      "msg": "ensure this value has at least 1 characters",
      "input": ""
    }
  ]
}
```

**Server Error (500):**
```json
{
  "status": "error",
  "message": "Internal server error",
  "detail": "An unexpected error occurred. Please try again."
}
```

**Example with cURL:**
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "こんにちは",
    "user_id": "user_123",
    "session_id": "session_abc",
    "language": "ja"
  }'
```

**Example with Python:**
```python
import requests

response = requests.post(
    "http://localhost:8000/api/chat",
    json={
        "message": "Hello, how are you?",
        "user_id": "user_123",
        "session_id": "session_abc",
        "language": "en"
    }
)
print(response.json())
```

### GET /api/health

**Purpose:** Verify API is running and healthy (useful for monitoring/load balancers).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-04T10:30:45.123456"
}
```

**Example with cURL:**
```bash
curl http://localhost:8000/api/health
```

---

## Integration with Frontend

### Frontend URL

The frontend (Next.js) runs on: **`http://localhost:3000`**

This URL is pre-configured in `core/config.py` under `cors_origins` to allow the frontend to make requests to the backend.

### Frontend Integration Example

In `frontend/components/chat-panel.tsx`, modify the `handleSubmit` function to call the backend:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!message.trim()) return;

  const userMessage: Message = {
    id: Date.now().toString(),
    role: "user",
    content: message.trim(),
  };

  setMessages((prev) => [...prev, userMessage]);
  setMessage("");

  try {
    // Call backend API
    const response = await fetch("http://localhost:8000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userMessage.content,
        user_id: "user_123",
        session_id: "session_abc",
        language: "en"
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Handle response from backend
    const aiResponse: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: `AI Response (Message ID: ${data.message_id})`
    };
    setMessages((prev) => [...prev, aiResponse]);

  } catch (error) {
    console.error("API Error:", error);
    // Handle error appropriately
  }
};
```

### Backend Integration Checklist

- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend accessible at `http://localhost:3000`
- [ ] CORS configured to allow frontend origin
- [ ] Health check endpoint working (`/api/health`)
- [ ] Chat endpoint receiving messages (`POST /api/chat`)
- [ ] Messages logged to backend console

---

## Logging & Debugging

### Log Output

The backend logs all incoming messages with context:

```
2026-05-04 10:30:45 - naragi_backend - INFO - Chat message received | ID: msg_abc123 | User: user_123 | Session: session_abc | Language: en | Message: こんにちは、日本語を勉強しています...
```

**Log Levels:**
- `DEBUG` - Detailed information for debugging
- `INFO` - General informational messages (default)
- `WARNING` - Warning messages (e.g., validation errors)
- `ERROR` - Error messages with full traceback

### Changing Log Level

Update `LOG_LEVEL` in `.env` or `core/config.py`:

```python
# core/config.py
log_level: str = "DEBUG"  # Show debug messages
```

Or via environment variable:
```bash
export LOG_LEVEL=DEBUG
python main.py
```

### Common Issues

**Issue:** CORS error in browser console
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:** Ensure frontend URL is in `core/config.py` `cors_origins` list.

**Issue:** Connection refused
```
ConnectionError: Could not connect to http://localhost:8000
```
**Solution:** Ensure backend is running with `python main.py`

**Issue:** Module not found error
```
ModuleNotFoundError: No module named 'fastapi'
```
**Solution:** Install dependencies with `pip install -r requirements.txt`

---

## Architecture Decisions

### Modular Structure

The backend is organized into logical modules to follow the Separation of Concerns principle:

- **`main.py`** - Application orchestration (what runs)
- **`core/`** - Infrastructure (config, logging)
- **`routers/`** - API endpoints (how requests are handled)
- **`schemas/`** - Data contracts (what data is accepted)

This separation makes the codebase:
- **Testable** - Each module can be tested independently
- **Maintainable** - Changes to one module don't affect others
- **Scalable** - Easy to add new routers, schemas, or utilities

### Logging over Print

All output uses the `logging` module instead of `print()` statements:

**Benefits:**
- Structured, consistent log format with timestamps
- Adjustable log levels for different environments
- Easy to redirect logs to files or monitoring services
- Supports log aggregation tools (ELK, Splunk, etc.)

### Stateless Design

The backend is designed to be stateless:

- No session storage in memory
- Each request is self-contained
- Enables horizontal scaling (multiple instances)
- Simplifies deployment and load balancing

### Strict Input Validation

Pydantic schemas validate all incoming requests at the API boundary:

**Benefits:**
- Prevents malformed data from reaching business logic
- Provides clear error messages to clients
- Reduces defensive coding in route handlers
- Supports automatic API documentation

---

## Future Enhancements

The backend is designed for easy integration with:

1. **LLM Core** - Queue messages to semantic cache and LLM processing service
2. **Database** - Persist messages for conversation history
3. **Authentication** - Add user authentication and authorization
4. **Rate Limiting** - Prevent abuse with request throttling
5. **Monitoring** - Integrate with APM tools (Sentry, DataDog, etc.)

---

## Summary

The AI NARAGI Backend is a production-ready, modular FastAPI service that:

- ✅ Receives chat messages from the Next.js frontend
- ✅ Validates data with Pydantic schemas
- ✅ Logs all activity with structured logging
- ✅ Handles errors gracefully without crashing
- ✅ Uses CORS to allow frontend communication
- ✅ Provides clear API documentation
- ✅ Supports easy scaling and deployment

The modular architecture follows senior development practices and is ready for integration with the LLM backend, database, and production deployment.
