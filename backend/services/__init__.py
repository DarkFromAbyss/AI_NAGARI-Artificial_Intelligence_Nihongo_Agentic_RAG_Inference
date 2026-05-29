"""Backend services for specialized processing tasks."""

from services.language_detector import detect_language, get_language_confidence
from services.auth_service import AuthenticationService

__all__ = ["detect_language", "get_language_confidence", "AuthenticationService"]
