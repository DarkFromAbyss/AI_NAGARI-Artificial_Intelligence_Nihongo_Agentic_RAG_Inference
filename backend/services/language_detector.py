"""Language detection service for identifying query language in real-time.

This module implements ultra-fast language identification optimized for Japanese, English,
and Vietnamese. Uses script detection (regex) for Japanese followed by probabilistic
detection for other languages.
"""

import re
from typing import Optional, Tuple
from core.logger import get_logger

logger = get_logger(__name__)

# Unicode ranges for Japanese scripts (exact boundaries per Unicode standard)
HIRAGANA_RANGE = r'[\u3040-\u309F]'
KATAKANA_RANGE = r'[\u30A0-\u30FF]'
KANJI_RANGE = r'[\u4E00-\u9FFF]'

# Combined pattern for fast Japanese detection
JAPANESE_PATTERN = re.compile(f'({HIRAGANA_RANGE}|{KATAKANA_RANGE}|{KANJI_RANGE})')

# Try to import langdetect, but gracefully degrade if unavailable
try:
    from langdetect import detect as langdetect_detect
    from langdetect.lang_detect_exception import LangDetectException
    LANGDETECT_AVAILABLE = True
except ImportError:
    LANGDETECT_AVAILABLE = False
    logger.warning("langdetect not available; falling back to regex-only detection")


def detect_language(text: str) -> str:
    """Detect the language of input text and return ISO 639-1 language code.

    Uses fast script detection for Japanese, probabilistic detection for others.
    This function is optimized for sub-millisecond latency on typical query lengths.

    Args:
        text: Raw user query text (1-2000 chars typical)

    Returns:
        ISO 639-1 language code: "ja", "en", or "vi" (defaults to "en" if unclear)

    Process Flow:
        1. Validate and normalize input text
        2. Check for Japanese scripts (Hiragana, Katakana, Kanji) - O(n) regex scan
        3. If Japanese detected: return "ja" immediately (no further processing)
        4. If langdetect available: use probabilistic detection with en/vi/ja filters
        5. If langdetect fails or unavailable: apply heuristic detection rules
        6. Default to "en" if all detection methods are inconclusive
        7. Log detection results at DEBUG level for monitoring
    """
    if not text or not isinstance(text, str):
        logger.debug("Invalid text input for language detection; defaulting to 'en'")
        return "en"

    cleaned_text = text.strip()
    if not cleaned_text:
        logger.debug("Empty text after stripping; defaulting to 'en'")
        return "en"

    # Fast path: Detect Japanese using script detection (negligible overhead)
    if JAPANESE_PATTERN.search(cleaned_text):
        logger.debug(f"Language detected as 'ja' via script detection")
        return "ja"

    # Attempt probabilistic detection for en/vi/ja
    if LANGDETECT_AVAILABLE:
        detected_lang = _detect_with_langdetect(cleaned_text)
        if detected_lang:
            logger.debug(f"Language detected as '{detected_lang}' via langdetect")
            return detected_lang

    # Fallback: Heuristic detection based on character patterns
    detected_lang = _detect_with_heuristics(cleaned_text)
    logger.debug(f"Language detected as '{detected_lang}' via heuristics")
    return detected_lang


def _detect_with_langdetect(text: str) -> Optional[str]:
    """Detect language using langdetect library with error handling.

    Args:
        text: Cleaned input text

    Returns:
        ISO code ("ja", "en", "vi") or None if detection fails or unsupported

    Process Flow:
        1. Call langdetect.detect() with full text
        2. If LangDetectException: log warning and return None
        3. Map detected language to supported set (en/vi/ja)
        4. If unsupported: log warning and return None
        5. Return detected language code
    """
    try:
        detected = langdetect_detect(text)
        # langdetect returns ISO codes like "en", "ja", "vi"
        if detected in ("en", "vi", "ja"):
            return detected
        else:
            logger.debug(f"langdetect returned unsupported language '{detected}'")
            return None
    except LangDetectException as e:
        logger.debug(f"langdetect failed: {str(e)}")
        return None
    except Exception as e:
        logger.warning(f"Unexpected error in langdetect: {str(e)}")
        return None


def _detect_with_heuristics(text: str) -> str:
    """Fallback heuristic-based language detection.

    Analyzes character composition and common word patterns.

    Args:
        text: Cleaned input text

    Returns:
        ISO code: "vi", "en", or defaults to "en"

    Process Flow:
        1. Scan for Vietnamese diacritics (ả, ế, ũ, etc.) - common and distinctive
        2. If Vietnamese markers found: return "vi"
        3. Count Latin letters (a-z, A-Z)
        4. If >50% latin letters: return "en"
        5. Default to "en" (conservative fallback)
    """
    # Vietnamese diacritics (combining marks and precomposed characters)
    # Covers common vowels with tone marks
    vietnamese_pattern = re.compile(r'[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', re.IGNORECASE)

    if vietnamese_pattern.search(text):
        return "vi"

    # Count Latin letters (proxy for English)
    latin_count = sum(1 for c in text if c.isascii() and c.isalpha())
    total_chars = len(text)

    if total_chars > 0 and (latin_count / total_chars) > 0.5:
        return "en"

    # Conservative default: English
    return "en"


def get_language_confidence(text: str) -> Tuple[str, float]:
    """Detect language and return confidence score (0.0-1.0).

    This is useful for cases where certainty matters (e.g., user review UI).

    Args:
        text: Raw input text

    Returns:
        Tuple of (language_code, confidence_score)
        - Confidence 1.0 = High certainty (e.g., Japanese script detected)
        - Confidence 0.7-0.9 = Medium certainty (langdetect result)
        - Confidence 0.5-0.7 = Low certainty (heuristics)

    Process Flow:
        1. Call detect_language(text) to get language
        2. Re-run detection logic to calculate confidence based on method used
        3. Japanese script detection: confidence 1.0
        4. langdetect: confidence 0.85 (very reliable)
        5. Heuristics: confidence 0.6 (less reliable but acceptable fallback)
    """
    detected_lang = detect_language(text)

    if JAPANESE_PATTERN.search(text.strip()):
        return (detected_lang, 1.0)

    if LANGDETECT_AVAILABLE:
        try:
            langdetect_detect(text.strip())
            return (detected_lang, 0.85)
        except Exception:
            pass

    return (detected_lang, 0.6)
