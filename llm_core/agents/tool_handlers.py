"""Tool definitions for the agentic RAG system.

Implements search_vocabulary, search_grammar, and search_grammar_doc tools.
Based on baseline.ipynb with production hardening.
"""

import logging
from typing import Optional
from rapidfuzz import process, fuzz
from langchain_core.tools import tool
import pandas as pd

from llm_core.utils.logger import get_logger

logger = get_logger(__name__)


class ToolRegistry:
    """Registry to manage and initialize RAG tools with shared data.
    
    Lazy-loads DataFrames and FAISS indexes to avoid circular imports.
    """
    
    def __init__(self):
        """Initialize tool registry (data loaded lazily on first use)."""
        self._vocab_df: Optional[pd.DataFrame] = None
        self._grammar_df: Optional[pd.DataFrame] = None
        self._faiss_index = None
        self._ensemble_retriever = None

    def get_tools(self):
        """Return list of initialized tools for binding to LLM."""
        return [
            search_vocabulary,
            search_grammar,
            search_grammar_doc
        ]


# Global tool registry
tool_registry = ToolRegistry()


@tool
def search_vocabulary(word: str) -> str:
    """Search vocabulary database for a specific Japanese word.
    
    Use this tool when the user asks about vocabulary meanings,
    readings (furigana), pronunciation, or word frequency.
    
    Args:
        word: Japanese word to search (in Kanji or Hiragana)
    
    Returns:
        Formatted string with vocabulary information or error message
    
    Examples:
        - User: "What does 高校 mean?"
        - Tool: Call search_vocabulary("高校")
    """
    word = word.strip()
    
    # Normalize user input (Unicode NFKC, Kanji variants)
    from llm_core.utils.text_normalizer import normalize_text_input
    word = normalize_text_input(word)
    
    if not word:
        logger.warning("Empty word provided to search_vocabulary")
        return "Please provide a valid Japanese word to search."
    
    try:
        # Load vocab data (import here to avoid circular dependency)
        from llm_core.utils.data_loaders import load_vocabulary_csv
        import os
        vocab_path = os.path.join(os.path.dirname(__file__), 
                                  "../../data/vocabulary/final_anki.csv")
        df_vocab = load_vocabulary_csv(vocab_path)
        
        # Create search lists (vocabulary and furigana)
        vocab_list = df_vocab["sfld"].dropna().astype(str).tolist()
        reading_list = df_vocab["VocabFurigana"].dropna().astype(str).tolist()
        combined_list = vocab_list + reading_list
        
        # Fuzzy matching with confidence threshold
        match = process.extractOne(word, combined_list, scorer=fuzz.ratio)
        threshold = 100 if len(word) <= 2 else 75  # Stricter for short inputs
        
        if not match or match[1] < threshold:
            logger.debug("Vocab search no match: '%s' (threshold: %d)", word, threshold)
            return f"Vocabulary '{word}' not found in database."
        
        # Get matched keyword and find in DataFrame
        matched_keyword = match[0]
        mask = (df_vocab["sfld"] == matched_keyword) | \
               (df_vocab["VocabFurigana"] == matched_keyword)
        result = df_vocab[mask]
        
        if result.empty:
            logger.error("Data extraction failed for vocab: %s", matched_keyword)
            return f"Error retrieving data for '{word}'."
        
        # Format response
        row = result.iloc[0]
        response_parts = [
            f"Word: {matched_keyword}",
            f"Reading: {row.get('VocabFurigana', 'N/A')}",
            f"JLPT Level: {row.get('level', 'N/A')}",
            f"Meaning: {row.get('VocabDef_JP', 'N/A')}",
            f"Part of Speech: {row.get('VocabPos', 'N/A')}",
            f"Frequency: {row.get('frequency', 'N/A')}",
        ]
        
        logger.info("Vocab search success: '%s'", matched_keyword)
        return "\n".join(response_parts)
        
    except Exception as e:
        logger.error("Vocabulary search error: %s", e, exc_info=True)
        return "Unable to search vocabulary at this time."


@tool
def search_grammar(grammar_point: str, level: Optional[str] = None) -> str:
    """Search grammar patterns database.
    
    Use this tool when the user asks about Japanese grammar structures,
    conjugations, or grammatical patterns (e.g., ~だけ, ~なければならない).
    
    Args:
        grammar_point: Grammar pattern to search (e.g., "だけ")
        level: Optional JLPT level filter (N5, N4, N3, etc.)
    
    Returns:
        Formatted string with grammar information or error message
    """
    if not grammar_point or not grammar_point.strip():
        logger.warning("Empty grammar_point provided")
        return "Please provide a grammar pattern to search."
    
    try:
        # Load grammar data
        from llm_core.utils.data_loaders import load_grammar_csv
        import os
        grammar_path = os.path.join(os.path.dirname(__file__),
                                    "../../data/grammar/df.csv")
        df_grammar = load_grammar_csv(grammar_path)
        
        # Search by kana or sfld (pattern)
        mask = (df_grammar["kana"].str.contains(grammar_point, na=False, case=False) |
                df_grammar["sfld"].str.contains(grammar_point, na=False, case=False))
        
        result = df_grammar[mask]
        
        # Filter by level if provided
        if level:
            result = result[result["level"] == level.upper()]
        
        if result.empty:
            logger.debug("Grammar search no match: '%s' at level %s", grammar_point, level)
            return f"Grammar pattern '{grammar_point}' not found in database."
        
        # Return top 3 results to avoid context overflow
        top_results = result.head(3)
        response_lines = ["Grammar Patterns Found:"]
        
        for _, row in top_results.iterrows():
            pattern_info = (
                f"- Level: {row.get('level', 'N/A')} | "
                f"Pattern: {row.get('sfld', 'N/A')} ({row.get('kana', 'N/A')}) | "
                f"Meaning: {row.get('mean', 'N/A')}"
            )
            response_lines.append(pattern_info)
        
        logger.info("Grammar search success: found %d patterns for '%s'", 
                   len(top_results), grammar_point)
        return "\n".join(response_lines)
        
    except Exception as e:
        logger.error("Grammar search error: %s", e, exc_info=True)
        return "Unable to search grammar at this time."


@tool
def search_grammar_doc(query: str) -> str:
    """Hybrid semantic search across grammar documentation.
    
    Use this tool for complex questions that require full explanation,
    comparisons, or examples from grammar guides (e.g.,
    "Difference between は and が particles").
    
    Args:
        query: Natural language question or search query
    
    Returns:
        Relevant grammar guide content or error message
    """
    if not query or not query.strip():
        logger.warning("Empty query provided to search_grammar_doc")
        return "Please provide a valid search query."
    
    try:
        # Load FAISS index and ensemble retriever
        from llm_core.utils.data_loaders import load_faiss_index
        from langchain_community.retrievers import BM25Retriever
        from langchain_classic.retrievers import EnsembleRetriever
        import os
        
        faiss_path = os.path.join(os.path.dirname(__file__), 
                                  "../../data/faiss")
        embedding_model = "all-MiniLM-L6-v2"
        
        # Load FAISS and create retrievers
        vectorstore = load_faiss_index(faiss_path, embedding_model)
        
        # Create BM25 retriever from documents
        docstore = vectorstore.docstore._dict
        all_docs = list(docstore.values())
        bm25_retriever = BM25Retriever.from_documents(all_docs)
        bm25_retriever.k = 3
        
        # Create ensemble retriever (weighted combination)
        ensemble_retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, vectorstore.as_retriever(search_kwargs={"k": 3})],
            weights=[0.6, 0.4]
        )
        
        # Perform hybrid search
        docs = ensemble_retriever.invoke(query)
        
        if not docs:
            logger.debug("Grammar doc search returned no results for query: %s", query)
            return "No matching grammar documentation found."
        
        # Format results
        result_content = "\n\n".join([doc.page_content for doc in docs])
        logger.info("Grammar doc search success: %d documents retrieved", len(docs))
        return result_content
        
    except Exception as e:
        logger.error("Grammar doc search error: %s", e, exc_info=True)
        return "Unable to search grammar documentation at this time."
