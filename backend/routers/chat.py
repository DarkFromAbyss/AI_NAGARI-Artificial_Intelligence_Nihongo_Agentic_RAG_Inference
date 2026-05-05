"""Chat endpoint router.

This module implements the POST /api/chat endpoint that receives
user messages from the frontend, processes them, and returns
acknowledgment responses.
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, status
# from fastapi.responses import JSONResponse

from schemas.chat_schema import (
    ChatMessageRequest,
    ChatMessageResponse
)
from core.logger import get_logger

# Initialize logger for this module
logger = get_logger(__name__)

# Create router for chat endpoints
router = APIRouter(prefix="/api", tags=["chat"])


@router.post(
    "/chat",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Process user chat message",
    description="Receive and process a user's chat message from the frontend"
)
async def post_chat_message(request: ChatMessageRequest) -> ChatMessageResponse:
    """
    Handle incoming chat message from frontend.

    This endpoint receives a user's chat message, logs it for debugging,
    and returns a standardized response. The message is queued for
    processing by the LLM backend.

    Args:
        request: ChatMessageRequest containing validated message data

    Returns:
        ChatMessageResponse: Confirmation with message_id and timestamp

    Raises:
        HTTPException: On validation error (422) or server error (500)
    """
    try:
        # Generate unique message ID for tracking
        message_id = f"msg_{uuid.uuid4().hex[:12]}"
        current_timestamp = datetime.utcnow()

        # Log the incoming message with context
        logger.info(
            f"Chat message received | ID: {message_id} | "
            f"User: {request.user_id or 'anonymous'} | "
            f"Session: {request.session_id or 'none'} | "
            f"Language: {request.language} | "
            f"Message: {request.message[:100]}{'...' if len(request.message) > 100 else ''}"
        )

        # TODO: Queue message for LLM processing
        # This is where future integration with the semantic cache
        # and LLM core would occur

        # Return success response
        return ChatMessageResponse(
            status="success",
            message="Message received and queued for processing",
            message_id=message_id,
            timestamp=current_timestamp
        )

    except ValueError as validation_error:
        """Handle validation errors gracefully."""
        error_message = f"Validation error: {str(validation_error)}"
        logger.warning(error_message)

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_message
        )

    except Exception as unexpected_error:
        """Catch unexpected errors and return 500 without exposing internals."""
        error_message = f"Unexpected error in post_chat_message: {str(unexpected_error)}"
        logger.error(
            error_message,
            exc_info=True  # Include full traceback in logs
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your message. Please try again."
        )


@router.get(
    "/health",
    summary="Health check endpoint",
    description="Verify that the API is running and healthy"
)
async def health_check() -> dict:
    """
    Simple health check endpoint for monitoring and load balancers.

    Returns:
        dict: Status and timestamp
    """
    logger.debug("Health check endpoint called")
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }