"""Text normalization and preprocessing utilities.

Standardizes user input (Unicode handling, Kanji normalization).
Parses dual-track output format (<display> and <voice> tags).
"""

import re
import unicodedata
import pandas as pd
from typing import Tuple
from llm_core.utils.logger import get_logger

from pathlib import Path

logger = get_logger(__name__)
ROOT = Path(__file__).parent.parent.parent  # Adjust as needed to point to project root
logger.debug(f"TextNormalizer initialized | ROOT path: {ROOT}")
KANJI_MAPPING_PATH = ROOT / "data" / "vocabulary" / "Kyoiku Kanji Chinese Match.xlsx"
# C:\Users\ADMIN\Desktop\AI_NAGARI-Artificial_Intelligence_Nihongo_Agentic_RAG_Inference\data\vocabulary\Kyoiku Kanji Chinese Match.xlsx

df_kanji = pd.read_excel(KANJI_MAPPING_PATH, header = 1 ).drop(columns = ['Unnamed: 0', 'Character #'])

try: 
    logger.info(f"Loading Kanji mapping from {KANJI_MAPPING_PATH}")
    df_kanji = pd.read_excel(KANJI_MAPPING_PATH, header = 1 ).drop(columns = ['Unnamed: 0', 'Character #'])
    logger.info(f"Kanji mapping loaded successfully | {len(df_kanji)} entries")
except FileNotFoundError as e:
    logger.error(f"Failed to load Kanji mapping: {e}", exc_info=True)
    df_kanji = pd.DataFrame(columns=['Traditional (正體字)', 'Kanji (日本漢字)'])
except Exception as e:
    logger.error(f"Unexpected error loading Kanji mapping: {e}", exc_info=True)
    df_kanji = pd.DataFrame(columns=['Traditional (正體字)', 'Kanji (日本漢字)'])

   
KANJI_MAPPING = dict(zip(df_kanji['Traditional (正體字)'], df_kanji['Kanji (日本漢字)']))

# Kanji variant mapping for normalization
KANJI_EXTRA= {
    "强": "強",     # Cường variant
    "國": "国",     # Quốc old form
    "气": "気",     # Khí variant
    "发": "発",     # Phát variant
    "长": "長",     # Trường variant
    "汉": "漢",     # Hán variant
    "樱": "桜",     # Anh variant
    "學": "学"      # Học old form
}

KANJI_MAPPING.update(KANJI_EXTRA)

def normalize_text_input(text: str) -> str:
    """Normalize user input to standard Japanese text format.
    
    Applies Unicode NFKC normalization and Kanji standardization.
    Prevents false negatives due to variant character forms.
    
    Args:
        text: Raw user input string
    
    Returns:
        Normalized text string
    
    Example:
        normalized = normalize_text_input("学校  ")  # "学校"
    """
    if not text:
        return text

    original_text = text.strip()

    # Step 1: NFKC normalization (Full-width → Half-width, etc.)
    normalized_text = unicodedata.normalize("NFKC", original_text)

    # Step 2: Replace variant Kanji with standard forms
    for variant, standard in KANJI_MAPPING.items():
        if variant in normalized_text:
            normalized_text = normalized_text.replace(variant, standard)

    # Log if changes were made for debugging
    if original_text != normalized_text:
        logger.debug("Text normalized: '%s' → '%s'", original_text, normalized_text)

    return normalized_text


def extract_dual_track(response_text: str) -> Tuple[str, str]:
    """Parse dual-track output format into display and voice components.
    
    Extracts <display> tag for UI display and <voice> tag for TTS processing.
    Provides fallback if tags are missing (LLM hallucination safety).
    
    Args:
        response_text: Response containing <display> and <voice> tags
    
    Returns:
        Tuple of (display_text, voice_text)
    
    Example:
        display, voice = extract_dual_track(
            "<display>High school</display><voice>こうこう</voice>"
        )
        # Returns: ("High school", "こうこう")
    """
    # Extract <display> content
    display_match = re.search(r"<display>(.*?)</display>", response_text, re.DOTALL)
    display_text = display_match.group(1).strip() if display_match else response_text

    # Extract <voice> content
    voice_match = re.search(r"<voice>(.*?)</voice>", response_text, re.DOTALL)
    voice_text = voice_match.group(1).strip() if voice_match else ""

    logger.debug("Extracted display: %d chars, voice: %d chars", 
                 len(display_text), len(voice_text))
    
    return display_text, voice_text
