"""Main LLM orchestration service - SenseiAgent.

Implements the primary entry point for backend integration.
Orchestrates LangGraph agent, semantic cache, and tool handling.
"""

import os
import time
from typing import Optional
from dotenv import load_dotenv
from datetime import datetime

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, trim_messages
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition

from llm_core.schemas import MessageInputSchema, ModelResponseSchema
from llm_core.semantic_cache import SenseiSemanticCache
from llm_core.utils.logger import get_logger
from llm_core.utils.config_manager import load_config, get_model_path, get_data_directory
from llm_core.utils.text_normalizer import extract_dual_track
from llm_core.agents.state_definitions import AgentState
from llm_core.agents.tool_handlers import search_vocabulary, search_grammar, search_grammar_doc
from llm_core.prompts.system_prompts import SystemPromptManager

logger = get_logger(__name__)


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
        
        # Load configuration
        self.config = load_config(config_path)
        self.data_dir = get_data_directory(self.config)
        self.enable_cache = enable_cache
        
        # Initialize semantic cache
        self.semantic_cache = SenseiSemanticCache()
        logger.info("Semantic cache initialized")
        
        # Initialize LLM (Google Gemini)
        if not api_key:
            # Xác định đường dẫn tuyệt đối đến file .env
            # Cách 1: Nếu .env ở thư mục gốc của dự án:
            env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
            
            # Cách 2: Nếu .env nằm cùng thư mục với llm_service.py (trong thư mục llm_core)
            # env_path = os.path.join(os.path.dirname(__file__), '.env')
            
            # Khuyên dùng: Để .env ở thư mục gốc dự án
            
            if os.path.exists(env_path):
                 load_dotenv(env_path)
            else:
                 logger.warning(f"File .env không được tìm thấy tại: {env_path}")
            
            api_key = os.environ.get("GOOGLE_API_KEY")

        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment. Please check your .env file or environment variables.")
            
        
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash-lite",
            api_key=api_key,
            temperature=0.7
        )
        logger.info("Google Gemini LLM initialized")
        
        # Bind tools to LLM
        self.tools = [search_vocabulary, search_grammar, search_grammar_doc]
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # Initialize system prompts
        brain_path = os.path.join(os.path.dirname(self.data_dir), "brain", "7B")
        self.prompt_manager = SystemPromptManager(brain_path)
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
        trimmer = trim_messages(
            max_tokens=7,
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
        language = message_input.language
        
        logger.info(
            "Generating response | Session: %s | User: %s | Query: %s...",
            session_id, user_id, user_text[:100]
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
                    display_text, _ = extract_dual_track(cached_response)
                    
                    return ModelResponseSchema(
                        session_id=session_id,
                        assistant_text=display_text,
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
                    final_response_text = latest_message.content
            
            if not final_response_text:
                logger.warning("No response generated from agent")
                return self._error_response(session_id, "Unable to generate response")
            
            # Step 3: Extract display portion
            display_text, voice_text = extract_dual_track(final_response_text)
            
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
            
            # Step 5: Return formatted response
            return ModelResponseSchema(
                session_id=session_id,
                assistant_text=display_text,
                sources=["grammar_guide", "vocabulary_db"],
                metadata={
                    "cache_hit": False,
                    "latency_ms": latency_ms,
                    "iterations": iterations,
                    "has_voice": bool(voice_text)
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
