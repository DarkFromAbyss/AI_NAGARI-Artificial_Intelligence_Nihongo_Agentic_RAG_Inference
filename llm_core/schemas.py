"""Pydantic models for strict data validation between backend and llm_core.

Ensures API-first design with clear data contracts.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class MessageInputSchema(BaseModel):
    """Validates incoming requests from backend.
    
    Maps backend ChatMessageRequest to llm_core input format.
    Performed early to fail fast with 422 errors.
    """

    session_id: str = Field(
        ...,
        min_length=1,
        max_length=256,
        description="Unique identifier for the chat session"
    )
    user_text: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User input text for the AI agent"
    )
    user_id: Optional[str] = Field(
        default=None,
        max_length=256,
        description="Optional user identifier for personalization"
    )
    language: str = Field(
        default="en",
        description="Output language code: 'en' or 'vi'"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional context (mood, JLPT level, etc.)"
    )

    @field_validator("user_text")
    @classmethod
    def validate_user_text(cls, v: str) -> str:
        """Ensure user_text is non-empty after stripping whitespace."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("user_text must not be empty or whitespace-only")
        return stripped

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        """Restrict language to supported values."""
        if v not in ("en", "vi", "ja"):
            raise ValueError("language must be 'en', 'vi', or 'ja'")
        return v

    class Config:
        """Pydantic config for schema behavior."""
        json_schema_extra = {
            "example": {
                "session_id": "conv_12345",
                "user_text": "高校とは何ですか？",
                "user_id": "student_001",
                "language": "ja"
            }
        }


class ModelResponseSchema(BaseModel):
    """Standardized response structure returned to backend.
    
    Backend extracts assistant_text and formats for frontend.
    Does not include <voice> tag; backend handles TTS separately.
    """

    session_id: str = Field(
        ...,
        description="Echo back session ID for request tracking"
    )
    assistant_text: str = Field(
        ...,
        description="Generated response with <display> tags"
    )
    sources: List[str] = Field(
        default_factory=list,
        description="Retrieved documents used in reasoning"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Latency (ms), token_usage, cache_hit flag, etc."
    )

    class Config:
        """Pydantic config for schema behavior."""
        json_schema_extra = {
            "example": {
                "session_id": "conv_12345",
                "assistant_text": "<display>High school (高校) is the Japanese secondary education stage from grades 10-12...</display>",
                "sources": ["vocabulary_db:高校", "grammar_guide:school_system"],
                "metadata": {
                    "cache_hit": False,
                    "latency_ms": 3200,
                    "token_usage": 450
                }
            }
        }
