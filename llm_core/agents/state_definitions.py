"""LangGraph agent state definitions.

Defines the TypedDict state structure for the agentic RAG orchestrator.
"""

from typing import Annotated, List, TypedDict, Optional, Any
from langgraph.graph.message import add_messages
from langchain_core.messages import AnyMessage


class AgentState(TypedDict):
    """State passed through the LangGraph agent nodes.
    
    Tracks message history, user language preference, and retrieved context.
    """
    
    messages: Annotated[List[AnyMessage], add_messages]
    """Message history with automatic concatenation of new messages."""
    
    display_lang: str
    """Output language: 'en', 'vi', or 'ja'."""
    
    retrieved_documents: Optional[List[str]] = None
    """Retrieved context from tools (vocabulary, grammar, RAG)."""
    
    reasoning_step: int = 0
    """Current iteration count for retry loops."""
    
    tool_used: Optional[str] = None
    """Last tool invoked (vocab_search, grammar_search, rag_retrieval)."""
