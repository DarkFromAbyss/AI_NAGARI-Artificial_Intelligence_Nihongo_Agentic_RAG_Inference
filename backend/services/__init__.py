"""Backend services for specialized processing tasks."""

from services.language_detector import detect_language, get_language_confidence

__all__ = ["detect_language", "get_language_confidence"]
