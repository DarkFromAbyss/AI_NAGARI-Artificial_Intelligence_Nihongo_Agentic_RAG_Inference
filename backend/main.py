"""FastAPI application factory and configuration.

This module initializes the FastAPI application, configures middleware
(CORS, logging), registers routes, and sets up exception handlers.
"""

import sys
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from core.config import settings
from core.logger import get_logger
from routers import auth, chat, tts, profile

# Initialize logger for main module
logger = get_logger(__name__)

# Load environment variables early to ensure GOOGLE_API_KEY and other secrets are available
load_dotenv()
logger.debug("Environment variables loaded from .env file")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    
    Initializes the llm_core.SenseiAgent and Voicevox TTS service at startup
    and stores them in app.state for access by route handlers.

    Args:
        app: FastAPI application instance
    """
    # ========== STARTUP ==========
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"CORS enabled for origins: {settings.cors_origins}")
    
    # Add project root to sys.path for llm_core imports
    backend_dir = Path(__file__).parent
    project_root = backend_dir.parent
    logger.debug(f"Backend directory: {backend_dir}")
    logger.debug(f"Project root directory: {project_root}")
    
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
        logger.debug(f"Added project root to sys.path: {project_root}")
    
    # Load centralized configuration
    config_loader = None
    try:
        from llm_core.utils.config_manager import ConfigLoader
        
        config_path = project_root / "config.yaml"
        
        if not config_path.exists():
            raise FileNotFoundError(
                f"Configuration file not found at {config_path}. "
                f"Ensure config.yaml exists in the project root directory."
            )
        
        config_loader = ConfigLoader(str(config_path))
        logger.info("ConfigLoader initialized with config: %s", config_path)
        app.state.config_loader = config_loader
        
    except ImportError as import_error:
        logger.warning(
            "Failed to import ConfigLoader from llm_core: %s. "
            "Using default configuration.",
            import_error
        )
    except FileNotFoundError as file_error:
        logger.warning(
            "Configuration file not found: %s. "
            "Using default configuration.",
            file_error
        )
    
    # Initialize SenseiAgent for chat processing
    try:
        from llm_core.llm_service import SenseiAgent
        
        # Determine config path (relative to project root)
        config_path = project_root / "config.yaml"
        
        if not config_path.exists():
            raise FileNotFoundError(
                f"Configuration file not found at {config_path}. "
                f"Ensure config.yaml exists in the project root directory."
            )
        
        logger.info(f"Initializing SenseiAgent with config: {config_path}")
        agent = SenseiAgent(config_path=str(config_path))
        
        # Store agent in app state for route handlers to access
        app.state.sensei_agent = agent
        logger.info("SenseiAgent initialized successfully and ready for chat processing")
        
    except FileNotFoundError as file_error:
        logger.error(f"Configuration file error: {file_error}")
        logger.warning(
            "Chat endpoint will be unavailable. "
            "Ensure config.yaml exists at the project root."
        )
        app.state.sensei_agent = None
        
    except ImportError as import_error:
        logger.error(
            f"Failed to import SenseiAgent from llm_core: {import_error}",
            exc_info=True
        )
        logger.warning(
            "Chat endpoint will be unavailable. "
            "Ensure llm_core package is properly installed."
        )
        app.state.sensei_agent = None
        
    except ValueError as value_error:
        logger.error(
            f"SenseiAgent initialization failed due to invalid configuration: {value_error}",
            exc_info=True
        )
        logger.warning(
            "Chat endpoint will be unavailable. "
            "Ensure GOOGLE_API_KEY is set and config.yaml is valid."
        )
        app.state.sensei_agent = None
        
    except Exception as unexpected_error:
        logger.error(
            f"Unexpected error during SenseiAgent initialization: {unexpected_error}",
            exc_info=True
        )
        logger.warning(
            "Chat endpoint will be unavailable. Check GOOGLE_API_KEY, config.yaml, and dependencies."
        )
        app.state.sensei_agent = None
    
    # Initialize TTS service (Voicevox engine)
    try:
        from tts.voicevox_service import VoicevoxTTSService
        
        logger.info("Initializing Voicevox TTS service...")
        tts_service = VoicevoxTTSService(auto_play=False, config_loader=config_loader)
        
        # Start the Voicevox engine subprocess with 30s timeout
        if tts_service.start_engine(timeout=30):
            app.state.tts_service = tts_service
            logger.info("Voicevox TTS engine started successfully and ready for synthesis")
        else:
            logger.error("Failed to start Voicevox engine - TTS endpoint will not be operational")
            app.state.tts_service = None
    
    except ImportError as import_error:
        logger.error(
            f"Failed to import Voicevox TTS service: {import_error}",
            exc_info=True
        )
        logger.warning("TTS endpoint will be unavailable.")
        app.state.tts_service = None
    
    except Exception as tts_error:
        logger.error(
            f"Unexpected error during TTS service initialization: {tts_error}",
            exc_info=True
        )
        logger.warning("TTS endpoint will be unavailable.")
        app.state.tts_service = None
    
    yield
    
    # ========== SHUTDOWN ==========
    logger.info(f"Shutting down {settings.app_name}")
    
    # Clean up TTS service
    if hasattr(app.state, "tts_service") and app.state.tts_service:
        try:
            app.state.tts_service.stop_engine()
            logger.info("Voicevox TTS engine stopped successfully")
        except Exception as e:
            logger.error(f"Error stopping TTS engine: {e}")
    
    # Clean up SenseiAgent
    if hasattr(app.state, "sensei_agent") and app.state.sensei_agent:
        logger.info("SenseiAgent resources cleaned up")


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.

    This factory function sets up:
    - CORS middleware for frontend communication
    - Request/response middleware
    - Exception handlers
    - Route registration
    - Startup/shutdown lifespan

    Returns:
        FastAPI: Configured application instance
    """
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Backend API for AI NARAGI chat interface",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan
    )

    # ==================== MIDDLEWARE SETUP ====================

    # CORS Middleware - Allow frontend to make requests
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        max_age=600,  # Cache preflight requests for 10 minutes
    )

    # ==================== EXCEPTION HANDLERS ====================

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle Pydantic validation errors with detailed logging."""
        logger.error(f"[VALIDATION_ERROR] Request validation failed on {request.url.path}")
        logger.error(f"[VALIDATION_ERROR] Method: {request.method}")
        
        errors = {}
        for error in exc.errors():
            # Extract field name from error location
            # Location might be ('body', 'fieldname') or just ('fieldname',)
            field = 'general'
            if error['loc']:
                loc = error['loc']
                # Skip 'body' if it's the first element (for request body validation)
                if len(loc) >= 2 and loc[0] == 'body':
                    field = str(loc[1])
                elif loc and loc[0] != 'body':
                    field = str(loc[0])
            
            msg = error['msg']
            errors[field] = msg
            logger.error(f"  - Field '{field}': {msg} (type: {error['type']})")
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "errors": errors
            }
        )

    @app.exception_handler(status.HTTP_422_UNPROCESSABLE_ENTITY)
    async def http_422_handler(request: Request, exc: Exception):
        """Handle HTTP 422 errors."""
        logger.warning(f"HTTP 422 on {request.url.path}: {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "errors": {"general": "Request validation failed"}
            }
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Catch-all exception handler for unhandled errors."""
        logger.error(
            f"Unhandled exception on {request.url.path}: {str(exc)}",
            exc_info=True
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": "Internal server error",
                "detail": "An unexpected error occurred. Please try again."
            }
        )

    # ==================== ROUTE REGISTRATION ====================

    # Include authentication routes
    app.include_router(auth.router)
    
    # Include profile routes
    app.include_router(profile.router)
    
    # Include chat routes
    app.include_router(chat.router)
    
    # Include TTS routes
    app.include_router(tts.router)

    # ==================== HEALTH CHECK ENDPOINT ====================
    
    @app.get("/health")
    async def health_check():
        """Simple health check to verify backend is operational."""
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": settings.app_version,
            "sensei_agent_initialized": hasattr(app.state, "sensei_agent") and app.state.sensei_agent is not None,
            "tts_service_initialized": hasattr(app.state, "tts_service") and app.state.tts_service is not None,
        }

    logger.info("FastAPI application created and configured successfully")
    return app


# Create the application instance
app = create_app()


# ==================== ENTRY POINT ====================

if __name__ == "__main__":
    import uvicorn

    logger.info(
        f"Starting Uvicorn server on {settings.server_host}:{settings.server_port}"
    )

    uvicorn.run(
        app,
        host=settings.server_host,
        port=settings.server_port,
        log_level=settings.log_level.lower(),
        reload=settings.debug
    )