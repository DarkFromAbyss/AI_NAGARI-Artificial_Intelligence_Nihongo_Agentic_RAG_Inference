from pydantic import BaseSettings, Field


class AppConfig(BaseSettings):
    """Application configuration loaded from environment variables."""

    environment: str = Field("development", env="APP_ENV")
    api_prefix: str = Field("/api/v1", env="API_PREFIX")
    model_path: str = Field("models/qwen2.5-7b-instruct.gguf", env="MODEL_PATH")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def get_settings() -> AppConfig:
    """Return the active configuration for the backend service."""
    return AppConfig()
