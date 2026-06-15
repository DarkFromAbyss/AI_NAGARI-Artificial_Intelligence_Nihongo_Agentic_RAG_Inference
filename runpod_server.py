"""
Microservice Server cho LLM Core trên RunPod
File: runpod_server.py
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import từ thư viện llm_core của bạn
from llm_core.llm_service import SenseiAgent
from llm_core.schemas import MessageInputSchema, ModelResponseSchema

# Load biến môi trường (chứa GOOGLE_API_KEY)
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Khởi tạo SenseiAgent và Cache khi server bật"""
    print("🚀 Đang khởi tạo LLM Core Service...")
    try:
        # Khởi tạo agent giống cách bạn làm trong main.py cũ
        # Đảm bảo file config.yaml nằm cùng thư mục chạy
        agent = SenseiAgent(config_path="config.yaml", enable_cache=True)
        app.state.agent = agent
        print("✅ SenseiAgent đã sẵn sàng!")
    except Exception as e:
        print(f"❌ Lỗi khởi tạo SenseiAgent: {e}")
        app.state.agent = None
    
    yield
    
    print("🛑 Đang tắt LLM Core Service...")

# Khởi tạo FastAPI
app = FastAPI(
    title="NARAGI LLM Core - RunPod Microservice",
    version="1.0.0",
    lifespan=lifespan
)

# Cấu hình CORS để Local Backend có thể gọi tới
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép mọi nguồn gọi tới
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "LLM Core is running on GPU (RunPod)"}

@app.post("/api/generate", response_model=ModelResponseSchema)
async def generate_llm_response(request: MessageInputSchema):
    """
    Endpoint chính nhận request từ Local Backend, 
    chuyển cho SenseiAgent xử lý và trả về ModelResponseSchema.
    """
    if not app.state.agent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SenseiAgent chưa được khởi tạo đúng cách."
        )
    
    try:
        # Gọi hàm generate_response của SenseiAgent đã được viết sẵn
        response = app.state.agent.generate_response(request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi generate LLM: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    # Chạy server ở port 8000
    uvicorn.run("runpod_server:app", host="0.0.0.0", port=8000, reload=False)