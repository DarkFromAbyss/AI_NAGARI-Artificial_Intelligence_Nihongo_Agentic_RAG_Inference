import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.app.core.config import get_settings
from llm_core.llm_service import SenseiAgent
from llm_core.schemas import MessageInputSchema, ModelResponseSchema

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")

settings = get_settings()
app = FastAPI(title="AI NARAGI Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sensei_agent = SenseiAgent(model_path=settings.model_path)


@app.get("/health", summary="Health check")
def health_check() -> dict:
    """Return service health state for monitoring and uptime checks."""
    logger.info("Health check requested")
    return {"status": "ok", "environment": settings.environment}


@app.post("/api/v1/message", response_model=ModelResponseSchema)
async def create_message_response(message_input: MessageInputSchema) -> ModelResponseSchema:
    """Process a chat request and return a structured assistant response."""
    logger.info("Received message for session_id=%s", message_input.session_id)
    try:
        response = sensei_agent.generate_response(message_input)
        logger.info("Generated response for session_id=%s", response.session_id)
        return response
    except Exception as error:
        logger.exception("Failed to generate response")
        raise HTTPException(status_code=500, detail="LLM core processing failed")
