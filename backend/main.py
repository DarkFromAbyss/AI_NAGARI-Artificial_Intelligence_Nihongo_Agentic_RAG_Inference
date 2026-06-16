"""FastAPI application factory and configuration (Bản chuẩn: Giữ nguyên TTS + Thêm RunPod)."""

import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import httpx

from core.config import settings
from core.logger import get_logger
from routers import auth, chat, tts, profile

# IMPORT DỊCH VỤ TTS VÀO ĐÂY (Vui lòng kiểm tra đường dẫn import nếu cần)
from tts.voicevox_service import VoicevoxTTSService 

# Initialize logger for main module
logger = get_logger(__name__)

# Load environment variables
load_dotenv()
logger.debug("Environment variables loaded from .env file")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ========== STARTUP ==========
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"CORS enabled for origins: {settings.cors_origins}")
    
    # 1. KHỞI TẠO ĐỊNH TUYẾN RUNPOD CHO LLM CORE (MỚI)
    runpod_url = os.getenv("RUNPOD_LLM_URL", "http://localhost:8001")
    logger.info(f"🌐 Định tuyến LLM Core sang RunPod tại: {runpod_url}")
    
    app.state.runpod_url = runpod_url.rstrip("/")
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(120.0, connect=10.0) 
    )
    
    # 2. KHÔI PHỤC: KHỞI TẠO VOICEVOX TTS SERVICE (CŨ)
    logger.info("Initializing Voicevox TTS Service at Local Backend...")
    try:
        service = VoicevoxTTSService()
        success = service.start_engine(timeout=30)
        
        if success:
            app.state.tts_service = service
            logger.info("✅ Voicevox TTS engine started successfully")
        else:
            logger.warning("⚠️ Failed to start Voicevox TTS engine (timeout or not found)")
            app.state.tts_service = service # Vẫn gán để Endpoint còn nhận diện được service
            
    except Exception as tts_err:
        logger.error(f"Error initializing TTS service: {tts_err}", exc_info=True)
        app.state.tts_service = None

    yield
    
    # ========== SHUTDOWN ==========
    logger.info("Shutting down application...")
    
    # 1. Đóng kết nối HTTP Client của RunPod
    if hasattr(app.state, "http_client"):
        await app.state.http_client.aclose()
        logger.info("✅ HTTP Client connection to RunPod closed.")
        
    # 2. KHÔI PHỤC: TẮT VOICEVOX TTS ENGINE (CŨ)
    if hasattr(app.state, "tts_service") and app.state.tts_service:
        logger.info("Stopping Voicevox TTS engine...")
        try:
            app.state.tts_service.stop_engine()
            logger.info("✅ Voicevox TTS engine stopped successfully")
        except Exception as e:
            logger.error(f"Error stopping TTS service: {e}")


def create_app() -> FastAPI:
    """Khởi tạo và cấu hình FastAPI application instance."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ==================== ROUTE REGISTRATION ====================
    app.include_router(auth.router)
    app.include_router(profile.router)
    app.include_router(chat.router)
    app.include_router(tts.router) # Router này giờ đã có thể hoạt động bình thường!

    # ==================== HEALTH CHECK ====================
    @app.get("/health")
    async def health_check():
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": settings.app_version,
            "runpod_endpoint_configured": hasattr(app.state, "runpod_url") and app.state.runpod_url is not None,
            "tts_service_initialized": hasattr(app.state, "tts_service") and app.state.tts_service is not None,
        }

    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting Uvicorn server on {settings.server_host}:{settings.server_port}")
    uvicorn.run("main:app", host=settings.server_host, port=settings.server_port, reload=True)