"""Centralized logging module for the LLM core system.

Provides consistent log formatting and prevents print() statements.
All output must use get_logger() to comply with rules.md.
"""

import logging
import os
from typing import Optional


def get_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """Return a configured logger instance with standardized formatting.
    
    Args:
        name: Logger name (typically __name__)
        level: Optional log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
               Defaults to INFO or environment variable LOG_LEVEL
    
    Returns:
        Configured logging.Logger instance
    
    Example:
        logger = get_logger(__name__)
        logger.info("Chat message received | Session: %s", session_id)
    """
    if level is None:
        level = os.environ.get("LOG_LEVEL", "INFO")

    logger = logging.getLogger(name)
    
    # Only configure if not already configured (prevent duplicate handlers)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    logger.setLevel(getattr(logging, level.upper()))
    return logger


# Module-level logger for this package
logger = get_logger(__name__)
