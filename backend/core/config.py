"""Configuration settings for the FastAPI application.

This module centralizes all environment-based and static configuration
to maintain consistency and enable easy deployment across environments.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application metadata
    app_name: str = "AI NARAGI Chat API"
    app_version: str = "1.0.0"
    debug: bool = False

    # Server configuration
    server_host: str = "127.0.0.1"
    server_port: int = 8000

    # CORS configuration - origins allowed to access the API
    cors_origins: List[str] = [
        "http://localhost:3000",      # Next.js development server
        "http://127.0.0.1:3000",
        "http://localhost:5173",      # Vite development server (alternative)
        "http://127.0.0.1:5173",
    ]

    # Logging configuration
    log_level: str = "INFO"

    class Config:
        """Pydantic settings configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()