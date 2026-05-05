"""FastAPI application factory and configuration.

This module initializes the FastAPI application, configures middleware
(CORS, logging), registers routes, and sets up exception handlers.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from core.config import settings
from core.logger import get_logger
from routers import chat

# Initialize logger for main module
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.

    Args:
        app: FastAPI application instance
    """
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"CORS enabled for origins: {settings.cors_origins}")
    yield
    # Shutdown
    logger.info(f"Shutting down {settings.app_name}")


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
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        max_age=600,  # Cache preflight requests for 10 minutes
    )

    # ==================== EXCEPTION HANDLERS ====================

    @app.exception_handler(status.HTTP_422_UNPROCESSABLE_ENTITY)
    async def validation_exception_handler(request: Request, exc: Exception):
        """Handle Pydantic validation errors."""
        logger.warning(f"Validation error on {request.url.path}: {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status": "error",
                "message": "Request validation failed",
                "detail": str(exc)
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

    # Include chat routes
    app.include_router(chat.router)

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