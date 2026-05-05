"""Pydantic schemas for chat endpoint validation.

These schemas enforce strict type checking and validation for all
incoming and outgoing chat data, preventing malformed requests
from reaching business logic.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ChatMessageRequest(BaseModel):
    """Request schema for sending a chat message.

    Attributes:
        message: The user's chat message text
        user_id: Optional identifier for the user
        session_id: Optional identifier for the conversation session
        language: Optional language code (e.g., 'en', 'ja')
    """
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User's chat message"
    )
    user_id: Optional[str] = Field(None, description="Optional user identifier")
    session_id: Optional[str] = Field(None, description="Optional session identifier")
    language: Optional[str] = Field("en", description="Language code (ISO 639-1)")

    class Config:
        """Pydantic config for JSON schema generation."""
        json_schema_extra = {
            "example": {
                "message": "こんにちは、日本語を勉強しています。",
                "user_id": "user_123",
                "session_id": "session_abc",
                "language": "ja"
            }
        }


class ChatMessageResponse(BaseModel):
    """Response schema for chat message processing.

    Attributes:
        status: Status of the request ('success' or 'error')
        message: Human-readable message
        message_id: Unique identifier for the processed message
        timestamp: When the message was processed
    """
    status: str = Field(..., description="Request status")
    message: str = Field(..., description="Response message")
    message_id: str = Field(..., description="Unique message identifier")
    timestamp: datetime = Field(..., description="Processing timestamp")

    class Config:
        """Pydantic config for JSON schema generation."""
        json_schema_extra = {
            "example": {
                "status": "success",
                "message": "Message received and queued for processing",
                "message_id": "msg_12345",
                "timestamp": "2026-05-04T10:30:45.123456"
            }
        }


class ErrorResponse(BaseModel):
    """Response schema for error responses.

    Attributes:
        status: Always 'error'
        message: Error message
        detail: Detailed error information
    """
    status: str = Field(default="error", description="Status indicator")
    message: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error info")