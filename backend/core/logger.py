"""Logging configuration for the FastAPI application.

Provides centralized, structured logging throughout the application
to ensure consistent logging practices and aid in debugging.
"""

import logging
import sys
from typing import Optional

from .config import settings


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Get or create a logger instance with standardized configuration.

    Args:
        name: Logger name (typically __name__ from calling module)

    Returns:
        logging.Logger: Configured logger instance
    """
    logger = logging.getLogger(name or "naragi_backend")

    # Only configure if not already configured
    if not logger.handlers:
        logger.setLevel(getattr(logging, settings.log_level))

        # Create formatter with timestamp, level, and message
        formatter = logging.Formatter(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

        # Add console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, settings.log_level))
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger