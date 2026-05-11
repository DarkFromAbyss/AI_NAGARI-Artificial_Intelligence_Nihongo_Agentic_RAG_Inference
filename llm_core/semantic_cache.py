"""Semantic caching layer to reduce latency and API costs.

Stores and retrieves responses for similar queries using embeddings.
Provides fast path for repeated or similar questions.
"""

import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import numpy as np
from llm_core.utils.logger import get_logger
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

logger = get_logger(__name__)

# Similarity threshold for cache hits (cosine similarity)
CACHE_HIT_THRESHOLD = 0.75


class SenseiSemanticCache:
    """Manage semantic search and caching for the LLM pipeline.
    
    Stores query-response pairs in an in-memory cache with embeddings.
    Enables fast retrieval for similar queries without LLM inference.
    """

    def __init__(
        self,
        embedding_model_name: str = "all-MiniLM-L6-v2",
        cache_expire_hours: int = 24
    ) -> None:
        """Initialize the semantic cache.
        
        Args:
            embedding_model_name: HuggingFace model for embeddings
            cache_expire_hours: Cache entry expiration time (hours)
        """
        self.embedding_model_name = embedding_model_name
        self.cache_expire_hours = cache_expire_hours
        self.logger = logger
        
        # In-memory storage for cache entries
        # Structure: {query_hash: {"query": str, "response": str, "timestamp": datetime, ...}}
        self._cache_store: Dict[str, Dict[str, Any]] = {}
        
        # Initialize embeddings model
        self._initialize_embeddings()
        
        # FAISS index for similarity search (initialized lazily)
        self._faiss_index: Optional[FAISS] = None
        self._documents_cache: List[Document] = []
        
        self.logger.info("SenseiSemanticCache initialized with model: %s",
                         embedding_model_name)

    def _initialize_embeddings(self) -> None:
        """Initialize HuggingFace embeddings model."""
        try:
            self.embeddings = HuggingFaceEmbeddings(
                model_name=self.embedding_model_name
            )
            self.logger.debug("Embeddings model loaded: %s", 
                             self.embedding_model_name)
        except Exception as e:
            self.logger.error("Failed to initialize embeddings: %s", e, exc_info=True)
            raise

    def search(
        self,
        query_text: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Search cache for similar past queries.
        
        Args:
            query_text: Current user query
            top_k: Maximum number of results to return
        
        Returns:
            List of similar cached responses with similarity scores
        
        Example:
            results = cache.search("高校とは何ですか？")
            if results and results[0]["score"] > 0.75:
                return results[0]["response"]  # Cache hit
        """
        if not query_text or not query_text.strip():
            self.logger.warning("Received empty query for cache search")
            return []

        try:
            # Embed the query
            query_embedding = self.embeddings.embed_query(query_text)

            # If FAISS index is empty, initialize it with current cache
            if not self._documents_cache:
                self.logger.debug("FAISS index is empty, no cache hits possible")
                return []

            # Create temporary FAISS index from cached documents
            if self._faiss_index is None:
                self._rebuild_faiss_index()

            # Search using FAISS (returns (doc, score) tuples)
            results_with_scores = self._faiss_index.similarity_search_with_score(
                query_text,
                k=min(top_k, len(self._documents_cache))
            )

            # Filter by threshold and format results
            valid_results = []
            for doc, score in results_with_scores:
                # FAISS uses L2 distance; convert to similarity (lower score = better match)
                similarity = 1 / (1 + score)  # Convert L2 to similarity [0, 1]
                
                if similarity >= CACHE_HIT_THRESHOLD:
                    # Retrieve cached entry metadata
                    cache_data = self._cache_store.get(doc.metadata.get("cache_key"))
                    if cache_data and not self._is_expired(cache_data["timestamp"]):
                        valid_results.append({
                            "query": cache_data["query"],
                            "response": cache_data["response"],
                            "score": float(similarity),
                            "timestamp": cache_data["timestamp"],
                            "intent": cache_data.get("intent", "general")
                        })

            self.logger.info("Cache search completed: query='%s...' | hits=%d | top_score=%.2f",
                           query_text[:50], len(valid_results),
                           valid_results[0]["score"] if valid_results else 0.0)
            return valid_results

        except Exception as e:
            self.logger.error("Cache search failed: %s", e, exc_info=True)
            return []

    def save(
        self,
        query: str,
        response: str,
        intent: str = "general"
    ) -> bool:
        """Cache a query-response pair for future reuse.
        
        Args:
            query: Original user query
            response: Generated response from LLM
            intent: Query classification (vocab, grammar, rag, general)
        
        Returns:
            True if saved successfully, False otherwise
        """
        if not query or not response:
            self.logger.warning("Cannot cache empty query or response")
            return False

        try:
            # Generate unique cache key
            cache_key = f"cache_{len(self._cache_store)}_{datetime.now().timestamp()}"

            # Store in cache
            self._cache_store[cache_key] = {
                "query": query,
                "response": response,
                "intent": intent,
                "timestamp": datetime.now()
            }

            # Create Document for FAISS indexing
            doc = Document(
                page_content=query,
                metadata={"cache_key": cache_key}
            )
            self._documents_cache.append(doc)

            # Rebuild FAISS index (lazy optimization: could batch this)
            self._rebuild_faiss_index()

            self.logger.info("Cached response: query='%s...' | intent=%s | cache_size=%d",
                           query[:50], intent, len(self._cache_store))
            return True

        except Exception as e:
            self.logger.error("Failed to cache response: %s", e, exc_info=True)
            return False

    def _rebuild_faiss_index(self) -> None:
        """Rebuild FAISS index from cached documents.
        
        Called when cache is updated to enable similarity search.
        """
        try:
            if self._documents_cache:
                self._faiss_index = FAISS.from_documents(
                    self._documents_cache,
                    self.embeddings
                )
                self.logger.debug("FAISS index rebuilt with %d documents",
                                len(self._documents_cache))
            else:
                self._faiss_index = None
                self.logger.debug("FAISS index cleared (empty cache)")
        except Exception as e:
            self.logger.error("Failed to rebuild FAISS index: %s", e, exc_info=True)
            self._faiss_index = None

    def _is_expired(self, timestamp: datetime) -> bool:
        """Check if cache entry has expired.
        
        Args:
            timestamp: Cache entry creation time
        
        Returns:
            True if expired, False otherwise
        """
        expiration_time = timestamp + timedelta(hours=self.cache_expire_hours)
        return datetime.now() > expiration_time

    def clear(self) -> None:
        """Clear all cached entries. Mainly for testing."""
        self._cache_store.clear()
        self._documents_cache.clear()
        self._faiss_index = None
        self.logger.info("Cache cleared")

    def get_stats(self) -> Dict[str, Any]:
        """Return cache statistics for monitoring.
        
        Returns:
            Dictionary with cache size, expiration settings, etc.
        """
        return {
            "cache_size": len(self._cache_store),
            "documents_indexed": len(self._documents_cache),
            "threshold": CACHE_HIT_THRESHOLD,
            "expire_hours": self.cache_expire_hours,
            "embedding_model": self.embedding_model_name
        }
