"""TTS synthesis endpoint router.

Provides REST API for real-time text-to-speech synthesis using Voicevox engine.
Returns audio streams for direct playback on the frontend.
"""

from fastapi import APIRouter, HTTPException, status, Request
from fastapi.responses import StreamingResponse, FileResponse
import io
from typing import Optional
from pydantic import BaseModel, Field
from pathlib import Path
from core.logger import get_logger
from tts.voicevox_service import VoicevoxTTSService

logger = get_logger(__name__)

# Create router for TTS endpoints
router = APIRouter(prefix="/api/tts", tags=["tts"])

# Global TTS service instance (initialized in main.py)
tts_service: Optional[VoicevoxTTSService] = None


class TTSSynthesisRequest(BaseModel):
    """Request schema for TTS synthesis endpoint."""
    
    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Japanese text to synthesize"
    )
    speaker_id: int = Field(
        default=1,
        ge=0,
        le=100,
        description="Voicevox speaker ID (1=female voice)"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for tracking"
    )

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "text": "こんにちは。今日の天気は晴れですね。",
                "speaker_id": 1,
                "session_id": "conv_12345"
            }
        }


@router.post(
    "/synthesize",
    summary="Synthesize Japanese text to speech",
    description="Convert Japanese text to audio using Voicevox engine with streaming response",
    responses={
        200: {
            "description": "Audio stream in WAV format",
            "content": {"audio/wav": {}},
        },
        400: {"description": "Invalid input"},
        503: {"description": "TTS engine unavailable"},
    }
)
async def post_synthesize(
    request_data: TTSSynthesisRequest,
    req: Request
) -> StreamingResponse:
    """
    Synthesize text to speech and stream audio to client.

    Receives Japanese text, synthesizes it to audio using Voicevox engine,
    and returns the audio stream with proper headers for browser playback.

    Args:
        request_data: TTSSynthesisRequest with text and speaker_id
        req: FastAPI Request for accessing app state

    Returns:
        StreamingResponse: Audio stream in WAV format

    Raises:
        HTTPException: On invalid input (400), engine unavailable (503)
    """
    try:
        text = request_data.text.strip()
        speaker_id = request_data.speaker_id
        session_id = request_data.session_id or "anonymous"

        logger.info(
            "TTS synthesis request | Session: %s | "
            "Text length: %d | Speaker: %d",
            session_id,
            len(text),
            speaker_id
        )

        # Validate text
        if not text or len(text) > 5000:
            raise ValueError("Text must be between 1 and 5000 characters")

        # Get TTS service from app state
        service: VoicevoxTTSService = req.app.state.tts_service

        if not service:
            logger.error("TTS service not initialized")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Text-to-speech service is not available"
            )

        # Synthesize audio
        output, error = service.synthesize(text, speaker_id)

        if error:
            logger.error("TTS synthesis failed: %s", error)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Audio synthesis failed: {error}"
            )

        if not output:
            logger.error("No audio output from TTS service")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to generate audio"
            )

        # Log successful synthesis
        logger.info(
            "Audio synthesized successfully | "
            "Duration: %.2fms | Synthesis time: %.2fms | Session: %s",
            output.duration_ms,
            output.synthesis_time_ms,
            session_id
        )

        # Return audio stream
        audio_stream = io.BytesIO(output.audio_data)

        return StreamingResponse(
            iter([output.audio_data]),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f"inline; filename=audio_{session_id}.wav",
                "X-Audio-Duration": str(output.duration_ms),
                "X-Synthesis-Time": str(output.synthesis_time_ms),
                "Cache-Control": "no-cache, no-store, must-revalidate",
            }
        )

    except ValueError as validation_error:
        logger.warning("Validation error: %s", str(validation_error))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(validation_error)
        )

    except HTTPException:
        raise

    except Exception as unexpected_error:
        logger.error(
            "Unexpected error in TTS synthesis: %s",
            str(unexpected_error),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during audio synthesis"
        )


@router.get(
    "/health",
    summary="Check TTS engine health",
    description="Verify that the TTS engine is running and responsive"
)
async def get_tts_health(req: Request) -> dict:
    """
    Health check endpoint for TTS engine.

    Returns:
        dict: Status and engine health info
    """
    try:
        service: VoicevoxTTSService = req.app.state.tts_service

        if not service:
            return {
                "status": "unavailable",
                "engine_ready": False,
                "message": "TTS service not initialized"
            }

        is_healthy = service.health_check()

        logger.debug("TTS health check | Status: %s", "healthy" if is_healthy else "unhealthy")

        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "engine_ready": service.is_ready,
            "engine_started": service.engine_start_time is not None,
        }

    except Exception as e:
        logger.error("Error in TTS health check: %s", str(e), exc_info=True)
        return {
            "status": "error",
            "engine_ready": False,
            "message": str(e)
        }


@router.get(
    "/voice-sample/{character_uuid}/{voice_id}/{sample_number}",
    summary="Get voice sample from Voicevox character",
    description="Stream a voice sample WAV file from Voicevox character_info folder",
    responses={
        200: {
            "description": "Voice sample WAV file",
            "content": {"audio/wav": {}},
        },
        404: {"description": "Voice sample not found"},
        400: {"description": "Invalid parameters"},
    }
)
async def get_voice_sample(
    character_uuid: str,
    voice_id: int,
    sample_number: int = 1
) -> StreamingResponse:
    """
    Stream a voice sample WAV file from Voicevox resources.

    Args:
        character_uuid: Character UUID from Voicevox
        voice_id: Voice speaker ID (110, 111, 3055, etc.)
        sample_number: Sample number (1, 2, or 3)

    Returns:
        StreamingResponse: WAV audio file

    Raises:
        HTTPException: If file not found or invalid parameters
    """
    try:
        # Validate parameters
        if not character_uuid or not character_uuid.strip():
            logger.warning("Invalid character_uuid: empty string")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid character_uuid"
            )

        if voice_id < 0:
            logger.warning("Invalid voice_id: %d", voice_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid voice_id"
            )

        if sample_number not in (1, 2, 3):
            logger.warning("Invalid sample_number: %d", sample_number)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sample_number must be 1, 2, or 3"
            )

        # Construct file path - go up to project root from backend/routers/tts.py
        backend_dir = Path(__file__).parent.parent
        project_root = backend_dir.parent
        voicevox_path = project_root / "voicevox" / "windows-directml" / "resources" / "character_info" / character_uuid / "voice_samples"
        
        # Format: 110_001.wav, 111_002.wav, etc.
        voice_file = voicevox_path / f"{voice_id}_{sample_number:03d}.wav"

        logger.debug(
            "Voice sample request | UUID: %s | Voice ID: %d | Sample: %d | Full Path: %s",
            character_uuid,
            voice_id,
            sample_number,
            voice_file.absolute()
        )

        # Verify file exists
        if not voice_file.exists():
            logger.warning(
                "Voice sample file not found | Path: %s | Voice ID: %d | Sample: %d",
                voice_file.absolute(),
                voice_id,
                sample_number
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Voice sample not found: {voice_id}_{sample_number:03d}.wav at {voice_file}"
            )

        # Verify it's actually a WAV file
        if voice_file.suffix.lower() != '.wav':
            logger.warning(
                "Invalid file type | Path: %s | Extension: %s",
                voice_file,
                voice_file.suffix
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is not a WAV audio file"
            )

        # Read file into memory
        logger.debug("Reading voice sample file | Size: %d bytes", voice_file.stat().st_size)
        file_data = voice_file.read_bytes()

        if not file_data:
            logger.error("Voice sample file is empty | Path: %s", voice_file)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Voice sample file is empty"
            )

        logger.debug("Successfully read voice sample | Voice ID: %d | Sample: %d | Size: %d bytes", voice_id, sample_number, len(file_data))

        # Return as streaming response with proper headers
        return StreamingResponse(
            iter([file_data]),
            media_type="audio/wav",
            headers={
                "Cache-Control": "public, max-age=86400",
                "Content-Disposition": f"inline; filename=voice_sample_{voice_id}_{sample_number:03d}.wav",
                "Content-Length": str(len(file_data)),
                "Accept-Ranges": "bytes",
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            "Error serving voice sample: %s | Exception: %s",
            str(e),
            type(e).__name__,
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving voice sample: {str(e)}"
        )
