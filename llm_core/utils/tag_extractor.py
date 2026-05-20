"""Regex-based XML tag extraction for TTS pipeline.

Extracts voice tag content from LLM dual-track output with robust error handling.
Follows rules.md: no print(), logging-only output, <50 lines per function.
"""

import re
from typing import Optional, Tuple
from dataclasses import dataclass
from llm_core.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class ExtractedTags:
    """Data structure for extracted XML tags from LLM output."""
    
    html: str
    text: str
    display: str
    voice: str
    intent: str
    raw_text: str
    extraction_success: bool
    error_message: Optional[str] = None


class TagExtractor:
    """Extracts and validates XML tags from LLM output.
    
    Expected format:<html>...</html>
                    <text>...</text>
                    <display>...</display>
                    <voice>...</voice>
                    <intent>...</intent>
    """
    
    # Regex patterns for safe XML tag extraction
    TAG_PATTERNS = {
        'html': r'<html>(.*?)</html>',
        'text': r'<text>(.*?)</text>',
        'display': r'<display>(.*?)</display>',
        'voice': r'<voice>(.*?)</voice>',
        'intent': r'<intent>(.*?)</intent>',
    }
    
    # Fallback values if extraction fails
    FALLBACK_VALUES = {
        'html': '<p>Processing error. Please try again.</p>',
        'text': 'Sorry, an error occurred while processing your request.',
        'display': 'Sorry, an error occurred while processing your request.',
        'voice': 'エラーが発生しました。',
        'intent': 'other',
    }

    @staticmethod
    def extract_tags(llm_output: str) -> ExtractedTags:
        """Extract XML tags from LLM output with comprehensive error handling.
        
        Args:
            llm_output: Raw LLM response containing XML tags
        
        Returns:
            ExtractedTags dataclass with all extracted tags and metadata
        """
        if not llm_output or not isinstance(llm_output, str):
            logger.warning(
                "Invalid LLM output: expected string, got %s", 
                type(llm_output).__name__
            )
            return TagExtractor._create_fallback_tags(llm_output, "Invalid output type")
        logger.info("LLM output: %s", llm_output)
        
        try:
            extracted = {}
            for tag_name, pattern in TagExtractor.TAG_PATTERNS.items():
                match = re.search(pattern, llm_output, re.DOTALL)
                logger.info("Extracting <%s> tag using pattern: %s| MATCH: %s", tag_name, pattern, match)
                if match:
                    extracted[tag_name] = match.group(1).strip()
                else:
                    logger.warning(
                        "Tag <%s> not found in LLM output", tag_name
                    )
                    extracted[tag_name] = TagExtractor.FALLBACK_VALUES[tag_name]

            # Validate intent tag (must be "other" or "search")
            if extracted['intent'] not in ('other', 'search'):
                logger.warning(
                    "Invalid intent value: %s. Using fallback 'other'.", 
                    extracted['intent']
                )
                extracted['intent'] = 'other'
                
            
            return ExtractedTags(
                html=extracted['html'],
                text=extracted['text'],
                display=extracted['display'],
                voice=extracted['voice'],
                intent=extracted['intent'],
                raw_text=llm_output,
                extraction_success=True,
                error_message=None
            )

        except Exception as e:
            logger.error(
                "Error during tag extraction: %s", str(e), exc_info=True
            )
            return TagExtractor._create_fallback_tags(
                llm_output, f"Extraction failed: {str(e)}"
            )

    @staticmethod
    def extract_voice_only(llm_output: str) -> Tuple[str, bool]:
        """Extract only the <voice> tag content for TTS synthesis.
        
        Args:
            llm_output: Raw LLM response
        
        Returns:
            Tuple of (voice_text, success_flag)
        """
        try:
            pattern = TagExtractor.TAG_PATTERNS['voice']
            match = re.search(pattern, llm_output, re.DOTALL)

            if match:
                voice_text = match.group(1).strip()
                if voice_text:
                    logger.debug("Successfully extracted voice text: %d chars", len(voice_text))
                    return voice_text, True
                else:
                    logger.warning("Voice tag found but empty")
                    return TagExtractor.FALLBACK_VALUES['voice'], False
            else:
                logger.warning("Voice tag not found in LLM output")
                return TagExtractor.FALLBACK_VALUES['voice'], False

        except Exception as e:
            logger.error(
                "Error extracting voice tag: %s", str(e), exc_info=True
            )
            return TagExtractor.FALLBACK_VALUES['voice'], False

    @staticmethod
    def validate_xml_structure(text: str) -> bool:
        """Validate that text contains properly balanced XML tags.
        
        Args:
            text: Text to validate
        
        Returns:
            True if all required tags are present
        """
        required_tags = ['html', 'text', 'display', 'voice', 'intent']
        for tag in required_tags:
            pattern = f'<{tag}>.*?</{tag}>'
            if not re.search(pattern, text, re.DOTALL):
                logger.warning("Required tag <%s> not found", tag)
                return False
        return True

    @staticmethod
    def _create_fallback_tags(
        raw_text: str, 
        error_msg: str
    ) -> ExtractedTags:
        """Create fallback ExtractedTags when extraction fails.
        
        Args:
            raw_text: Original LLM output
            error_msg: Error message to log
        
        Returns:
            ExtractedTags with fallback values
        """
        logger.warning("Using fallback tags due to: %s", error_msg)
        return ExtractedTags(
            html=TagExtractor.FALLBACK_VALUES['html'],
            text=TagExtractor.FALLBACK_VALUES['text'],
            display=TagExtractor.FALLBACK_VALUES['display'],
            voice=TagExtractor.FALLBACK_VALUES['voice'],
            intent=TagExtractor.FALLBACK_VALUES['intent'],
            raw_text=raw_text,
            extraction_success=False,
            error_message=error_msg
        )

    @staticmethod
    def sanitize_voice_text(text: str) -> str:
        """Clean voice text to ensure TTS compatibility.
        
        Removes extra whitespace, handles special characters for TTS.
        
        Args:
            text: Japanese text for TTS
        
        Returns:
            Sanitized text
        """
        # Remove excessive whitespace while preserving punctuation
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Ensure proper spacing around Japanese punctuation
        text = re.sub(r'([、。！？])(\w)', r'\1 \2', text)
        
        logger.debug("Sanitized voice text: %d chars", len(text))
        return text
