"""Main LLM orchestration service - SenseiAgent.

Implements the primary entry point for backend integration.
Orchestrates LangGraph agent, semantic cache, and tool handling.
"""

import os
import time
from dotenv import load_dotenv
from typing import Optional, Union, List, Dict, Any
from datetime import datetime

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, trim_messages
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition

from llm_core.schemas import MessageInputSchema, ModelResponseSchema
from llm_core.semantic_cache import SenseiSemanticCache
from llm_core.utils.logger import get_logger
from llm_core.utils.config_manager import ConfigLoader, load_config, get_model_path, get_data_directory
from llm_core.utils.text_normalizer import extract_dual_track
from llm_core.utils.tag_extractor import TagExtractor
from llm_core.agents.state_definitions import AgentState
from llm_core.agents.tool_handlers import search_vocabulary, search_grammar, search_grammar_doc
from llm_core.prompts.system_prompts import SystemPromptManager

logger = get_logger(__name__)


def _normalize_llm_content(content: Union[str, List[Dict[str, Any]]]) -> str:
    """Convert LLM message content to string, handling Google Gemini API format.
    
    Google's Gemini API returns content as either:
    - A string (simple text response)
    - A list of content blocks: [{'type': 'text', 'text': '...'}, ...]
    
    Args:
        content: Raw message content from LLM (string or list)
    
    Returns:
        Normalized content as a string
    
    Process Flow:
        1. If content is already a string, return it directly
        2. If content is a list, iterate through each block
        3. Extract text from blocks with type='text' (Google API format)
        4. Concatenate all text blocks with newlines
        5. Return concatenated result or empty string if no text found
        6. Log warnings for unexpected formats
    """
    if isinstance(content, str):
        return content
    
    if isinstance(content, list):
        text_parts = []
        for block in content:
            if isinstance(block, dict) and block.get('type') == 'text':
                text = block.get('text', '')
                if text:
                    text_parts.append(text)
        
        if text_parts:
            result = ''.join(text_parts)  # Concatenate without extra newlines
            logger.debug(f"Extracted text from {len(content)} content blocks: {len(result)} chars")
            return result
        else:
            logger.warning(f"No text blocks found in content list: {len(content)} items")
            return ""
    
    # Fallback for unexpected types
    logger.warning(f"Unexpected content type: {type(content).__name__}. Converting to string.")
    return str(content)


class SenseiAgent:
    """Main orchestrator for the AI NARAGI language learning assistant.
    
    Manages LangGraph agent execution, semantic caching, and backend integration.
    Implements the complete agentic RAG pipeline with self-reflection.
    """

    def __init__(
        self,
        config_path: str = "config.yaml",
        enable_cache: bool = True,
        api_key: Optional[str] = None
    ) -> None:
        """Initialize the SenseiAgent with configuration and models.
        
        Args:
            config_path: Path to config.yaml
            enable_cache: Enable semantic caching
            api_key: Google Gemini API key (defaults to environment variable)
        
        Raises:
            FileNotFoundError: If config or required data not found
            ValueError: If API key not available
        """
        logger.info("Initializing SenseiAgent...")
        
        # Load configuration using ConfigLoader
        self.config_loader = ConfigLoader(config_path)
        self.config = self.config_loader.config  # Keep for backward compatibility
        self.data_dir = str(self.config_loader.get_data_directory())
        self.enable_cache = enable_cache
        
        logger.info("Configuration loaded from %s", config_path)
        
        # Initialize semantic cache
        self.semantic_cache = SenseiSemanticCache()
        logger.info("Semantic cache initialized")
        
        # Initialize LLM (Google Gemini)
        if not api_key:
            # Try to load from .env file (project root)
            env_path = self.config_loader.project_root / ".env"
            
            if env_path.exists():
                load_dotenv(str(env_path))
                logger.debug("Environment variables loaded from %s", env_path)
            else:
                logger.warning("File .env not found at %s", env_path)
            
            api_key = os.environ.get("GOOGLE_API_KEY")

        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment. Please check your .env file or environment variables.")
        
        # Get LLM configuration from config.yaml
        llm_model = self.config_loader.get_parameter_safe("llm.model_name", "gemini-2.5-flash-lite")
        llm_temperature = self.config_loader.get_parameter_safe("llm.temperature", 0.7)
        
        self.llm = ChatGoogleGenerativeAI(
            model=llm_model,
            api_key=api_key,
            temperature=llm_temperature
        )
        logger.info("Google Gemini LLM initialized with model: %s", llm_model)
        
        # Bind tools to LLM
        self.tools = [search_vocabulary, search_grammar, search_grammar_doc]
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # Initialize system prompts using brain path from ConfigLoader
        brain_path = self.config_loader.get_brain_path()
        self.prompt_manager = SystemPromptManager(str(brain_path))
        logger.info("System prompts loaded from %s", brain_path)
        
        # Build LangGraph
        self._build_graph()
        logger.info("LangGraph agent built successfully")

    def _build_graph(self) -> None:
        """Build the LangGraph state machine for agentic RAG."""
        graph_builder = StateGraph(AgentState)
        
        # Define nodes
        graph_builder.add_node("chatbot", self._chatbot_node)
        graph_builder.add_node("tools", ToolNode(self.tools))
        
        # Add edges
        graph_builder.add_edge(START, "chatbot")
        graph_builder.add_conditional_edges("chatbot", tools_condition)
        graph_builder.add_edge("tools", "chatbot")
        graph_builder.add_edge("chatbot", END)
        
        # Compile graph
        self.agent_app = graph_builder.compile()
        logger.debug("LangGraph compiled successfully")

    def _chatbot_node(self, state: AgentState) -> dict:
        """Process user query and generate response (LangGraph node).
        
        Args:
            state: Current agent state from LangGraph
        
        Returns:
            Updated state with new message
        """
        display_lang = state.get("display_lang", "en")
        recent_time = state.get("recent_time", "")
        
        # Assemble system prompt with temporal awareness
        system_prompt_text = self.prompt_manager.get_system_prompt(
            display_lang=display_lang,
            recent_time=recent_time
        )
        sys_msg = SystemMessage(content=system_prompt_text)
        
        # Prepare messages
        full_messages = [sys_msg] + state["messages"]
        
        # Apply message trimming to respect context windows
        max_tokens_trim = self.config_loader.get_parameter_safe("llm.max_tokens_for_trimming", 7)
        trimmer = trim_messages(
            max_tokens=max_tokens_trim,
            strategy="last",
            token_counter=len,
            include_system=True,
            allow_partial=False,
            start_on="human"
        )
        trimmed_messages = trimmer.invoke(full_messages)
        
        # Call LLM with tools
        try:
            response = self.llm_with_tools.invoke(trimmed_messages)
            logger.debug("LLM response generated | tool_calls: %d", 
                        len(response.tool_calls) if hasattr(response, 'tool_calls') else 0)
            return {"messages": [response]}
        except Exception as e:
            logger.error("LLM invocation failed: %s", e, exc_info=True)
            raise

    def generate_response(
        self,
        message_input: MessageInputSchema,
        max_retries: int = 15
    ) -> ModelResponseSchema:
        """Generate a response from the AI core.
        
        Main entry point for backend integration.
        Performs cache check, LangGraph execution, and response formatting.
        
        Args:
            message_input: Validated input from backend
            max_retries: Maximum LangGraph iterations for agentic loop
        
        Returns:
            ModelResponseSchema with assistant response and metadata
        
        Process Flow:
            1. Validate input with Pydantic (already done by backend)
            2. Check semantic cache for similar past queries
            3. If cache hit (similarity > 0.75): Return cached response
            4. If cache miss: Execute LangGraph agent
            5. Extract <display> portion from response
            6. Save to cache for future reuse
            7. Return ModelResponseSchema with metadata
        """
        start_time = time.time()
        session_id = message_input.session_id
        user_text = message_input.user_text
        user_id = message_input.user_id
        language = message_input.language or "en"
        
        logger.info(
            "Generating response | Session: %s | User: %s | Query: %s | Language: %s",
            session_id, user_id, user_text[:100], language
        )
        
        try:
            # Step 1: Cache check
            cache_hit = False
            if self.enable_cache:
                cache_results = self.semantic_cache.search(user_text, top_k=1)
                if cache_results and cache_results[0]["score"] > 0.75:
                    logger.info("Cache hit for session %s | similarity: %.2f",
                              session_id, cache_results[0]["score"])
                    
                    cached_response = cache_results[0]["response"]
                    # Parse cached XML response properly
                    extracted = TagExtractor.extract_tags(cached_response)
                    return ModelResponseSchema(
                        session_id=session_id,
                        assistant_text=extracted.display,
                        html_content=extracted.html,
                        text_content=extracted.text,
                        voice_text=extracted.voice,
                        intent_classification=extracted.intent,
                        raw_output=cached_response,
                        sources=["cached_response"],
                        metadata={
                            "cache_hit": True,
                            "latency_ms": int((time.time() - start_time) * 1000),
                            "cache_similarity": cache_results[0]["score"]
                        }
                    )
            
            # Step 2: Execute LangGraph agent
            import time as time_module
            recent_time = time_module.strftime("%Y-%m-%d %H:%M:%S")
            
            logger.info("Cache miss for session %s , %s | Executing agent...", session_id, language)
            inputs = {
                "messages": [HumanMessage(content=user_text)],
                "display_lang": language,
                "recent_time": recent_time
            }
            
            config = {"configurable": {"thread_id": session_id}}
            final_response_text = ""
            
            # Stream through agent execution
            iterations = 0
            for chunk in self.agent_app.stream(
                inputs,
                config=config,
                stream_mode="values"
            ):
                iterations += 1
                if iterations > max_retries:
                    logger.warning("Max agent iterations reached: %d", max_retries)
                    break
                
                latest_message = chunk["messages"][-1]
                if latest_message.type == "ai" and latest_message.content:
                    # Normalize content: handle Google Gemini API format (list or string)
                    final_response_text = _normalize_llm_content(latest_message.content)
            
            logger.info(f"""Agent execution completed | 
                        Iterations: {iterations} | 
                        Final response length: {len(final_response_text)} chars| 
                        Content preview: {final_response_text}""")
            
            if not final_response_text:
                logger.warning("No response generated from agent")
                return self._error_response(session_id, "Unable to generate response")
            
            # Step 3: Parse XML tags from response
            extracted = TagExtractor.extract_tags(final_response_text)
            
            # Step 4: Cache the response
            if self.enable_cache:
                self.semantic_cache.save(
                    query=user_text,
                    response=final_response_text,
                    intent="general"
                )
                logger.debug("Response cached for future reuse")
            
            # Calculate latency
            latency_ms = int((time.time() - start_time) * 1000)
            
            logger.info(
                "Response generated successfully | Session: %s | Latency: %dms",
                session_id, latency_ms
            )
                        
            # Step 5: Return formatted response with all parsed fields
            return ModelResponseSchema(
                session_id=session_id,
                assistant_text=extracted.display,
                html_content=extracted.html,
                text_content=extracted.text,
                voice_text=extracted.voice,
                intent_classification=extracted.intent,
                raw_output=final_response_text,
                sources=["grammar_guide", "vocabulary_db"],
                metadata={
                    "cache_hit": False,
                    "latency_ms": latency_ms,
                    "iterations": iterations,
                    "extraction_success": extracted.extraction_success
                }
            )
            
        except Exception as e:
            logger.error(
                "Error generating response for session %s: %s",
                session_id, e, exc_info=True
            )
            return self._error_response(
                session_id,
                "System error occurred. Please try again."
            )

    def _error_response(self, session_id: str, error_message: str) -> ModelResponseSchema:
        """Generate error response with graceful fallback.
        
        Args:
            session_id: Session ID for tracking
            error_message: User-friendly error message
        
        Returns:
            ModelResponseSchema with error details
        """
        return ModelResponseSchema(
            session_id=session_id,
            assistant_text=f"<display>{error_message}</display>",
            sources=[],
            metadata={
                "cache_hit": False,
                "error": True,
                "latency_ms": 0
            }
        )
