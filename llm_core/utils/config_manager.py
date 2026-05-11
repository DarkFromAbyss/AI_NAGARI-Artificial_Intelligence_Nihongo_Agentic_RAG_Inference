"""Configuration management for the LLM core system.

Loads and validates configuration from YAML files.
Centralizes all environment-based settings per rules.md.
"""

import os
import yaml
from typing import Dict, Any, Optional
from pathlib import Path
from llm_core.utils.logger import get_logger

logger = get_logger(__name__)


def load_config(config_path: str) -> Dict[str, Any]:
    """Load and parse YAML configuration file.
    
    Args:
        config_path: Absolute or relative path to config.yaml
    
    Returns:
        Parsed configuration dictionary
    
    Raises:
        FileNotFoundError: If config file does not exist
        yaml.YAMLError: If YAML parsing fails
    
    Example:
        config = load_config("config.yaml")
        vocab_path = config["data_directory"]
    """
    if not os.path.exists(config_path):
        logger.error("Configuration file not found: %s", config_path)
        raise FileNotFoundError(f"Config file not found: {config_path}")
    
    try:
        with open(config_path, "r", encoding="utf-8") as file:
            config = yaml.safe_load(file)
        logger.info("Configuration loaded successfully from %s", config_path)
        return config
    except yaml.YAMLError as e:
        logger.error("YAML parsing error in %s: %s", config_path, e, exc_info=True)
        raise


def get_model_path(config: Dict[str, Any], model_name: str) -> str:
    """Resolve model path from configuration.
    
    Args:
        config: Configuration dictionary from load_config()
        model_name: Model identifier (e.g., "all-MiniLM-L6-v2", "Qwen2.5-7B-Instruct")
    
    Returns:
        Absolute path to model directory
    
    Raises:
        KeyError: If model_name not found in config
        FileNotFoundError: If resolved path does not exist
    
    Example:
        embedding_model_path = get_model_path(config, "all-MiniLM-L6-v2")
    """
    if "models" not in config:
        raise KeyError("'models' key not found in configuration")
    
    if model_name not in config["models"]:
        raise KeyError(f"Model '{model_name}' not found in configuration")
    
    model_path = config["models"][model_name]
    
    if not os.path.exists(model_path):
        logger.error("Model path does not exist: %s", model_path)
        raise FileNotFoundError(f"Model not found at: {model_path}")
    
    logger.debug("Resolved model path for '%s': %s", model_name, model_path)
    return model_path


def get_data_directory(config: Dict[str, Any]) -> str:
    """Resolve data directory path from configuration.
    
    Args:
        config: Configuration dictionary from load_config()
    
    Returns:
        Absolute path to data directory
    
    Raises:
        KeyError: If data_directory not in config
        FileNotFoundError: If path does not exist
    """
    if "data_directory" not in config:
        raise KeyError("'data_directory' not found in configuration")
    
    data_dir = config["data_directory"]
    
    if not os.path.exists(data_dir):
        logger.error("Data directory does not exist: %s", data_dir)
        raise FileNotFoundError(f"Data directory not found: {data_dir}")
    
    logger.debug("Data directory resolved: %s", data_dir)
    return data_dir
