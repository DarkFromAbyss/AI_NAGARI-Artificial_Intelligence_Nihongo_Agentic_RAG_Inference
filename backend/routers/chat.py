"""Chat endpoint router.

This module implements the POST /api/chat endpoint that receives
user messages from the frontend, processes them through llm_core.SenseiAgent,
and returns structured chat responses with display text and metadata.
"""

import uuid
import re
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Request

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
    description="Receive and process a user's chat message from the frontend using llm_core.SenseiAgent"
)
async def post_chat_message(request: ChatMessageRequest, req: Request) -> ChatMessageResponse:
    """
    Handle incoming chat message from frontend with full llm_core integration.

    This endpoint receives a user's chat message, transforms it into llm_core schema,
    invokes the SenseiAgent for intelligent processing, and returns a structured response
    containing the display text and metadata.

    Args:
        request: ChatMessageRequest containing validated message data
        req: FastAPI Request object for accessing app state

    Returns:
        ChatMessageResponse: Processed response with display text, message_id, and timestamp

    Raises:
        HTTPException: On validation error (422), agent unavailable (503), or server error (500)
    """
    try:
        # Generate unique message ID for tracking across system
        message_id = f"msg_{uuid.uuid4().hex[:12]}"
        current_timestamp = datetime.utcnow()

        # Log the incoming message with context
        logger.info(
            f"Chat message received | ID: {message_id} | "
            f"User: {request.user_id or 'anonymous'} | "
            f"Session: {request.session_id or 'auto-generated'} | "
            f"Language: {request.language} | "
            f"Message preview: {request.message[:100]}{'...' if len(request.message) > 100 else ''}"
        )

        # ========== STEP 1: Get SenseiAgent from app state ==========
        agent = req.app.state.sensei_agent
        
        if not agent:
            logger.error("SenseiAgent not initialized. Check GOOGLE_API_KEY and config.yaml")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Chat service temporarily unavailable. Please try again later."
            )

        # ========== STEP 2: Convert ChatMessageRequest to MessageInputSchema ==========
        from llm_core.schemas import MessageInputSchema
        
        # Generate session ID if not provided
        session_id = request.session_id or f"session_{uuid.uuid4().hex[:12]}"
        
        llm_input = MessageInputSchema(
            session_id=session_id,
            user_text=request.message,
            user_id=request.user_id,
            language=request.language or "en",
            metadata={
                "message_id": message_id,
                "source": "frontend",
                "timestamp": current_timestamp.isoformat()
            }
        )

        logger.debug(f"Converted to MessageInputSchema | Session: {session_id}")

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
        return ChatMessageResponse(
            status="success",
            display=display_text,  # Display text for UI
            voice=voice_text,  # Japanese text for TTS synthesis
            display2d= voice_text,  # For 3D WebGL rendering, we can use the same text or a formatted version
            message_id=message_id,
            timestamp=current_timestamp
        )

    except ValueError as validation_error:
        """Handle validation errors from llm_core schemas."""
        error_message = f"Input validation error: {str(validation_error)}"
        logger.warning(f"Validation error in {message_id}: {error_message}")

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_message
        )

    except Exception as unexpected_error:
        """Catch unexpected errors and return 500 without exposing internals."""
        error_message = f"Unexpected error in post_chat_message: {str(unexpected_error)}"
        logger.error(
            f"Error in {message_id}: {error_message}",
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