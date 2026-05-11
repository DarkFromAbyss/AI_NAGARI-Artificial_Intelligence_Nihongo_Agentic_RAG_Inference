"""Data loading utilities for vocabulary, grammar, and vector databases.

Centralizes data loading with error handling and caching for efficiency.
"""

import os
import pandas as pd
from typing import Optional
from llm_core.utils.logger import get_logger
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

logger = get_logger(__name__)


def load_vocabulary_csv(vocab_path: str) -> pd.DataFrame:
    """Load vocabulary CSV with error handling.
    
    Args:
        vocab_path: Path to final_anki.csv
    
    Returns:
        Pandas DataFrame with vocabulary data
    
    Raises:
        FileNotFoundError: If CSV file does not exist
        pd.errors.ParserError: If CSV parsing fails
    """
    if not os.path.exists(vocab_path):
        logger.error("Vocabulary CSV not found: %s", vocab_path)
        raise FileNotFoundError(f"Vocabulary file not found: {vocab_path}")
    
    try:
        df = pd.read_csv(vocab_path)
        df = df.fillna("")  # Fill NaN with empty strings
        logger.info("Loaded vocabulary CSV with %d rows from %s", len(df), vocab_path)
        return df
    except pd.errors.ParserError as e:
        logger.error("Failed to parse vocabulary CSV: %s", e, exc_info=True)
        raise


def load_grammar_csv(grammar_path: str) -> pd.DataFrame:
    """Load grammar CSV with error handling.
    
    Args:
        grammar_path: Path to grammar df.csv
    
    Returns:
        Pandas DataFrame with grammar data
    
    Raises:
        FileNotFoundError: If CSV file does not exist
        pd.errors.ParserError: If CSV parsing fails
    """
    if not os.path.exists(grammar_path):
        logger.error("Grammar CSV not found: %s", grammar_path)
        raise FileNotFoundError(f"Grammar file not found: {grammar_path}")
    
    try:
        df = pd.read_csv(grammar_path)
        # Remove unnamed index column if present
        if "Unnamed: 0" in df.columns:
            df = df.drop(columns=["Unnamed: 0"])
        logger.info("Loaded grammar CSV with %d rows from %s", len(df), grammar_path)
        return df
    except pd.errors.ParserError as e:
        logger.error("Failed to parse grammar CSV: %s", e, exc_info=True)
        raise


def load_faiss_index(
    faiss_path: str,
    embedding_model_name: str
) -> FAISS:
    """Load FAISS vector index with embeddings.
    
    Args:
        faiss_path: Path to FAISS index directory
        embedding_model_name: HuggingFace model name for embeddings
    
    Returns:
        FAISS vectorstore instance
    
    Raises:
        FileNotFoundError: If FAISS index does not exist
        RuntimeError: If FAISS loading fails
    """
    if not os.path.exists(faiss_path):
        logger.error("FAISS index not found: %s", faiss_path)
        raise FileNotFoundError(f"FAISS index not found: {faiss_path}")
    
    try:
        logger.info("Loading FAISS index from %s with model %s", 
                    faiss_path, embedding_model_name)
        
        embeddings = HuggingFaceEmbeddings(model_name=embedding_model_name)
        vectorstore = FAISS.load_local(
            folder_path=faiss_path,
            embeddings=embeddings,
            allow_dangerous_deserialization=True
        )
        
        logger.info("FAISS index loaded successfully")
        return vectorstore
    except Exception as e:
        logger.error("Failed to load FAISS index: %s", e, exc_info=True)
        raise RuntimeError(f"FAISS loading failed: {e}") from e


def load_markdown_file(file_path: str) -> str:
    """Load markdown file safely with fallback.
    
    Args:
        file_path: Path to markdown file
    
    Returns:
        File contents as string, or placeholder if missing
    
    Example:
        intro_content = load_markdown_file("brain/7B/intro.md")
    """
    if not os.path.exists(file_path):
        logger.warning("Markdown file not found: %s", file_path)
        return f"[File not found: {file_path}]"
    
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            content = file.read()
        logger.debug("Loaded markdown file: %s (%d chars)", file_path, len(content))
        return content
    except Exception as e:
        logger.error("Failed to read markdown file %s: %s", file_path, e, exc_info=True)
        return f"[Error reading file: {file_path}]"
