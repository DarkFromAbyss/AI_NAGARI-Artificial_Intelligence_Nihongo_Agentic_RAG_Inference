"""Chat endpoint router (Đã sửa lỗi cú pháp và tích hợp RunPod)."""

import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Request
import httpx  # Đảm bảo đã chạy: pip install httpx

from schemas.chat_schema import (
    ChatMessageRequest,
    ChatMessageResponse
)
from services.user_identification_service import UserIdentificationService
from core.logger import get_logger

# Khởi tạo logger cho module này
logger = get_logger(__name__)

# Tạo router cho các endpoint liên quan đến chat
router = APIRouter(prefix="/api", tags=["chat"])

# Khởi tạo dịch vụ nhận diện người dùng
user_id_service = UserIdentificationService()


@router.post(
    "/chat",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Process user chat message",
    description="Nhận tin nhắn từ frontend, đóng gói và chuyển lên xử lý tại GPU RunPod qua HTTP API"
)
async def post_chat_message(request: ChatMessageRequest, req: Request) -> ChatMessageResponse:
    """
    Xử lý trung chuyển dữ liệu chat giữa Frontend (Local) -> Backend Gateway (Local) -> LLM Core (RunPod)
    """
    message_id = f"msg_{uuid.uuid4()}"
    current_timestamp = datetime.now()

    # Tạo session_id ngẫu nhiên nếu frontend không truyền lên
    session_id = request.session_id or f"session_{uuid.uuid4()}"

    logger.info(f"Processing chat message {message_id} for session {session_id}")

    try:
        # Lấy HTTP Client và URL RunPod được cấu hình từ lifespan của main.py
        runpod_url = getattr(req.app.state, "runpod_url", None)
        client = getattr(req.app.state, "http_client", None)

        if not runpod_url or not client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Cấu hình kết nối RunPod chưa được khởi tạo ở file main.py"
            )

        # 1. Đóng gói payload chuẩn theo đúng cấu trúc MessageInputSchema của llm_core
        runpod_payload = {
            "session_id": session_id,
            "user_text": request.message,
            "user_id": request.user_id,
            "language": request.language or "vi",
            "metadata": {}
        }

        # Lấy Secret Key từ biến môi trường của Local (nếu có cấu hình bảo mật)
        # Nếu chưa làm phần bảo mật nâng cao, bạn có thể tạm thời comment dòng headers lại
        headers = {
            "X-API-Key": "Naragi_Super_Secret_Token_2026"
        }

        logger.debug(f"Sending payload to RunPod Microservice: {runpod_payload}")

        # 2. Thực hiện gọi API POST lên server RunPod (endpoint: /api/generate)
        runpod_endpoint = f"{runpod_url}/api/generate"
        response = await client.post(runpod_endpoint, json=runpod_payload, headers=headers)

        # Kiểm tra nếu RunPod gặp sự cố từ chối quyền hoặc lỗi hệ thống (500, 401, 404, v.v.)
        if response.status_code != status.HTTP_200_OK:
            logger.error(f"RunPod LLM Server returned error {response.status_code}: {response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Lõi xử lý LLM trên Cloud đang bận hoặc gặp lỗi xác thực."
            )

        # 3. Nhận dữ liệu JSON trả về (Cấu trúc chuẩn ModelResponseSchema từ RunPod)
        llm_core_data = response.json()
        logger.info(f"Successfully received response from RunPod for {message_id}")

        # 4. Mapping chuẩn dữ liệu từ ModelResponseSchema sang ChatMessageResponse của Frontend
        # - display: Chuỗi hiển thị ở màn hình chat (sử dụng assistant_text từ RunPod)
        # - voice: Đoạn text tiếng Nhật thuần để đưa vào TTS (sử dụng voice_text từ RunPod)
        # - display2d: Đoạn text sạch phục vụ WebGL (sử dụng text_content từ RunPod)
        return ChatMessageResponse(
            status="success",
            display=llm_core_data.get("assistant_text", ""),
            voice=llm_core_data.get("voice_text", ""),
            display2d=llm_core_data.get("text_content", ""),
            message_id=message_id,
            timestamp=current_timestamp
        )

    except httpx.RequestError as net_err:
        # Xử lý trường hợp sập mạng internet hoặc Pod chưa bật (Mất kết nối hoàn toàn tới RunPod)
        logger.error(f"Network error connecting to RunPod endpoint: {net_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không thể kết nối đến máy chủ GPU RunPod. Vui lòng kiểm tra trạng thái Pod hoặc mạng Internet."
        )

    except ValueError as validation_error:
        """Xử lý lỗi validate dữ liệu đầu vào/đầu ra."""
        error_message = f"Input validation error: {str(validation_error)}"
        logger.warning(f"Validation error in {message_id}: {error_message}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_message
        )

    except Exception as unexpected_error:
        """Bắt các lỗi ngoại lệ không lường trước để hệ thống không bị crash."""
        error_message = f"Unexpected error in post_chat_message: {str(unexpected_error)}"
        logger.error(f"Error in {message_id}: {error_message}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your message."
        )


@router.get(
    "/health",
    summary="Health check endpoint",
    description="Verify that the API is running and healthy"
)
async def health_check() -> dict:
    """
    Endpoint kiểm tra trạng thái hoạt động của router chat.
    """
    logger.debug("Health check endpoint called")
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }