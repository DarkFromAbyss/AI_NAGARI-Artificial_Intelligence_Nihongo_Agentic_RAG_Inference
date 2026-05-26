# AI NAGARI

**Artificial Intelligence Nihongo Agentic RAG Inference**

<div align="center">

![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.6.0-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square)

</div>

---

## 📖 Introduction

**AI NAGARI** is a cutting-edge web-based Japanese language learning platform that combines artificial intelligence, retrieval-augmented generation (RAG), and interactive 3D avatar technology. Built as a graduation thesis project, this system provides an immersive, personalized learning experience through intelligent conversational AI with real-time text-to-speech synthesis and 3D character interaction.

### 🎯 Key Features

- **Intelligent Japanese Grammar Tutoring** – Real-time, adaptive learning with context-aware explanations leveraging LLM technology and semantic understanding.
- **Semantic Caching for Low Latency** – FAISS-based vector database and Redis caching for rapid response times and optimized query performance.
- **Interactive 3D Avatar with TTS** – Photorealistic VRM character animation synchronized with natural language text-to-speech output using VOICEVOX technology.
- **Agentic RAG Pipeline** – LangGraph-based multi-agent system that retrieves relevant language learning materials and formats responses in real-time.
- **Language Detection & Routing** – Automatic language identification with intelligent intent routing for multilingual support.
- **Comprehensive Learning Materials** – Integrated JLPT vocabulary sets, grammar guides, and Anki deck support for structured learning progression.

---

## 🏗️ Project Architecture & Structure

```
AI_NAGARI-Artificial_Intelligence_Nihongo_Agentic_RAG_Inference/
│
├── 📁 frontend/                           # Next.js React Application
│   ├── components/                        # Reusable React components
│   │   ├── animated-greeting.tsx
│   │   ├── character-showcase.tsx        # 3D VRM character renderer
│   │   ├── chat-panel.tsx                # Chat interface
│   │   ├── audio-player.tsx              # TTS audio playback
│   │   └── ...
│   ├── app/                               # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Main application page
│   │   └── globals.css
│   ├── hooks/                             # Custom React hooks
│   ├── services/                          # Frontend API services
│   │   └── tts-service.ts                # Text-to-speech integration
│   ├── lib/                               # Utility functions & helpers
│   ├── public/                            # Static assets & 3D models
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   └── postcss.config.mjs
│
├── 📁 backend/                            # FastAPI Python Application
│   ├── main.py                            # FastAPI application factory
│   ├── core/
│   │   ├── config.py                     # Configuration management
│   │   └── logger.py                     # Centralized logging
│   ├── routers/                           # API endpoint definitions
│   │   ├── chat.py                       # Chat endpoint & LLM orchestration
│   │   └── tts.py                        # Text-to-speech endpoint
│   ├── services/                          # Business logic layer
│   │   ├── language_detector.py          # Language detection service
│   │   └── voicevox_service.py           # TTS synthesis service
│   ├── schemas/                           # Pydantic models
│   │   └── chat_schema.py                # Request/response schemas
│   ├── tts/                               # Text-to-speech modules
│   │   ├── voicevox_service.py
│   │   └── INTEGRATION_EXAMPLE.py
│   ├── api/                               # API utilities
│   └── requirements.txt
│
├── 📁 llm_core/                           # LLM Orchestration & AI Logic
│   ├── llm_service.py                     # Core LLM inference engine
│   ├── output_formatter.py                # XML tag extraction & formatting
│   ├── semantic_cache.py                  # Caching layer
│   ├── config.yaml                        # LLM configuration
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── agents/                            # LangGraph agent definitions
│   ├── chains/                            # LangChain chain configurations
│   ├── prompts/                           # System & few-shot prompts
│   └── utils/                             # Helper utilities
│
├── 📁 brain/                              # Learning Content & Rules
│   ├── 1.5B/                              # Model-specific knowledge bases
│   │   └── rules.md                       # Grammar rules & patterns
│   ├── 3B/
│   │   ├── intro.md                       # Introduction content
│   │   ├── context.md                     # Contextual information
│   │   └── rules.md
│   └── 7B/                                # Larger model variant
│       ├── intro.md
│       ├── context.md
│       └── rules.md
│
├── 📁 data/                               # Learning Datasets & Indexes
│   ├── collection.anki21                  # Anki deck for Japanese vocabulary
│   ├── grammar/
│   │   ├── df.csv                         # Grammar data frame
│   │   └── guide.md
│   ├── vocabulary/
│   │   ├── anki_jlpt_structured.csv      # JLPT vocabulary structured data
│   │   ├── df_final.csv
│   │   ├── final.csv
│   │   └── jmdict-eng-common-3.6.2.json  # Japanese-English dictionary
│   ├── faiss/                             # Vector database
│   │   └── index.faiss                    # FAISS semantic search index
│   ├── communicate/                       # Communication patterns
│   ├── route/                             # Routing data
│   └── experiment_results.json
│
├── 📁 models/                             # Pre-trained Model Weights
│   ├── all-MiniLM-L6-v2/                 # Embedding model
│   ├── Qwen2.5-1.5B-Instruct/            # 1.5B parameter model
│   └── [Other model variants]
│
├── 📁 database/                           # Database Setup & Schema
│   ├── schema.sql                         # Database schema definitions
│   ├── init_db.py                         # Database initialization script
│   └── docs.md
│
├── 📁 voicevox/                           # VOICEVOX TTS Engine
│   └── windows-directml/                  # Windows TTS binaries
│
├── 📁 test/                               # Test Suite & Results
│   └── comprehensive_test_results.csv
│
├── 📁 notebooks/                          # Jupyter Notebooks for Development
│   ├── baseline.ipynb                     # Baseline experiments
│   ├── grammar.ipynb                      # Grammar analysis
│   ├── routing.ipynb                      # Intent routing analysis
│   ├── vocabulary.ipynb                   # Vocabulary analysis
│   └── rag_evaluation_with_metadata.csv
│
├── 📁 docs/                               # Project Documentation
│   ├── backend_documentation.md
│   ├── frontend_documentation.md
│   └── [Additional guides]
│
├── config.yaml                            # Global configuration
├── system_description.md                  # System component registry
├── requirements.txt                       # Python dependencies
├── data_downloader.py                     # Dataset retrieval script
├── model_downloader.py                    # Model weight downloader
├── README_LLM_CORE.md                     # LLM core documentation
└── README.md                              # This file
```

---

## 🛠️ Tech Stack

### Frontend / 3D Rendering

| Technology | Purpose | Version |
|-----------|---------|---------|
| ![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js&logoColor=white) | Full-stack React framework | 14+ |
| ![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=white) | UI library & component framework | 18+ |
| ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) | Type-safe JavaScript | Latest |
| ![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=three.js&logoColor=white) | 3D graphics rendering engine | Latest |
| ![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber-000000?style=flat-square) | React renderer for Three.js | 9.6+ |
| ![Pixiv VRM](https://img.shields.io/badge/%40pixiv%2Fthree--vrm-FF6B9D?style=flat-square) | VRM 3D character animation | 3.5+ |
| ![Radix UI](https://img.shields.io/badge/Radix%20UI-161617?style=flat-square) | Headless UI components | Latest |
| ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) | Utility-first CSS framework | Latest |

### Backend / AI Orchestration

| Technology | Purpose | Details |
|-----------|---------|---------|
| ![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white) | Backend language | 3.10+ |
| ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white) | High-performance API framework | Latest |
| ![Pydantic](https://img.shields.io/badge/Pydantic-E92063?style=flat-square) | Data validation & settings | V2 |
| ![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat-square) | LLM orchestration framework | Latest |
| ![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat-square) | Agentic state machine & workflow | Latest |
| ![FAISS](https://img.shields.io/badge/FAISS-00A4EF?style=flat-square) | Semantic vector search & caching | Latest |
| ![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white) | Distributed caching layer | Latest |
| ![Chroma](https://img.shields.io/badge/Chroma-FF5722?style=flat-square) | Vector database | Latest |

### LLM & AI Models

| Model | Quantization | Use Case | Source |
|-------|--------------|----------|--------|
| **Qwen2.5-1.5B-Instruct** | 4-bit (bitsandbytes) | Lightweight inference | Hugging Face |
| **all-MiniLM-L6-v2** | Full precision | Text embedding & semantic search | Sentence Transformers |
| **Qwen2.5-7B-Instruct** | 4-bit (optional) | Enhanced reasoning (RunPod/Colab) | Hugging Face |

### Text-to-Speech (TTS)

| Component | Technology | Details |
|-----------|-----------|---------|
| **TTS Engine** | VOICEVOX | Japanese speech synthesis |
| **Platform Support** | Windows DirectML | GPU-accelerated TTS rendering |
| **Audio Output** | FastAPI streaming | Real-time audio delivery to frontend |

### Data Processing & NLP

| Technology | Purpose |
|-----------|---------|
| ![Pandas](https://img.shields.io/badge/Pandas-150458?style=flat-square&logo=pandas&logoColor=white) | Data manipulation & analysis |
| ![NumPy](https://img.shields.io/badge/NumPy-013243?style=flat-square&logo=numpy&logoColor=white) | Numerical computing |
| ![Sentence Transformers](https://img.shields.io/badge/Sentence%20Transformers-FF6B6B?style=flat-square) | Semantic embeddings |
| ![Semantic Router](https://img.shields.io/badge/Semantic%20Router-7C3AED?style=flat-square) | Intent detection & routing |
| **jaconv** | Japanese character conversion |
| **langdetect** | Language identification |

---

## 📦 Installation Guide 

### 📋 Prerequisites

Ensure you have the following installed on your system:

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **Python** 3.10 or higher ([Download](https://www.python.org/))
- **Git** for version control
- **CUDA 11.8+** (Optional but recommended for GPU acceleration)
- **VOICEVOX** TTS engine (Windows DirectML binary included in repo)

### 🎨 Frontend Setup

#### Step 1: Navigate to the frontend directory

```bash
cd frontend
```

#### Step 2: Install dependencies

Using **pnpm** (recommended for faster installation):

```bash
pnpm install
```

Or using **npm**:

```bash
npm install
```

Or using **yarn**:

```bash
yarn install
```

#### Step 3: Create environment configuration

Create a `.env.local` file in the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=AI NAGARI
```

#### Step 4: Run the development server

```bash
pnpm dev
```

The frontend will be available at **http://localhost:3000**

#### Step 5 (Optional): Build for production

```bash
pnpm build
pnpm start
```

---

### 🐍 Backend Setup

#### Step 1: Navigate to the project root

```bash
cd ..
```

#### Step 2: Create a Python virtual environment

**On Windows (PowerShell):**

```powershell
python -m venv env
.\env\Scripts\Activate.ps1
```

**On macOS/Linux:**

```bash
python3 -m venv env
source env/bin/activate
```

#### Step 3: Upgrade pip

```bash
pip install --upgrade pip
```

#### Step 4: Install Python dependencies

```bash
pip install -r requirements.txt
```

#### Step 5: Download pre-trained models

```bash
python model_downloader.py
```

This will download:
- Qwen2.5-1.5B-Instruct
- all-MiniLM-L6-v2 embedding model
- FAISS indexes

#### Step 6: Download learning datasets

```bash
python data_downloader.py
```

This retrieves:
- Japanese vocabulary & JLPT datasets
- Grammar rules and patterns
- Semantic search indexes

#### Step 7: Set up environment variables

Create a `.env` file in the root directory:

```env
# Google API Configuration
GOOGLE_API_KEY=your_google_api_key_here

# LLM Configuration
LLM_MODEL_NAME=Qwen/Qwen2.5-1.5B-Instruct
LLM_DEVICE=cuda  # or 'cpu' for CPU-only inference

# FastAPI Configuration
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Database Configuration
DATABASE_URL=sqlite:///./app.db
```

#### Step 8: Initialize the database

```bash
python backend/database/init_db.py
```

#### Step 9: Start the backend server

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at **http://localhost:8000**

API documentation:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

### 🔄 Full Application Startup (All Components)

#### Terminal 1 - Backend Server:

```bash
cd AI_NAGARI-Artificial_Intelligence_Nihongo_Agentic_RAG_Inference
.\env\Scripts\Activate.ps1  # or source env/bin/activate on macOS/Linux
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

#### Terminal 2 - Frontend Development Server:

```bash
cd AI_NAGARI-Artificial_Intelligence_Nihongo_Agentic_RAG_Inference/frontend
pnpm dev
```

#### Terminal 3 - VOICEVOX TTS Service (Windows):

```bash
.\voicevox\windows-directml\run.exe
```

Now the complete system is running:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## 🧠 System Architecture Overview

### Request Flow

```
┌─────────────────────┐
│   Frontend (React)  │
│   - Chat UI         │
│   - 3D Avatar       │
│   - Audio Output    │
└──────────┬──────────┘
           │ HTTP Request (Chat Message)
           ▼
┌─────────────────────────────────────────┐
│      Backend (FastAPI)                  │
│  ┌─────────────────────────────────────┐│
│  │ Router: /chat/send_message          ││
│  └──────────────┬──────────────────────┘│
│                 │                        │
│  ┌──────────────▼──────────────────────┐│
│  │ Language Detection Service          ││
│  │ - Detect user language              ││
│  │ - Identify learning intent          ││
│  └──────────────┬──────────────────────┘│
│                 │                        │
│  ┌──────────────▼──────────────────────┐│
│  │ Semantic Cache Check (Redis/FAISS)  ││
│  │ - Query vector embedding            ││
│  │ - Check for similar cached responses││
│  └──────────────┬──────────────────────┘│
│                 │                        │
│  ┌──────────────▼──────────────────────┐│
│  │ LLM Core (LangGraph Agent)          ││
│  │ - Retrieve learning materials (RAG) ││
│  │ - Generate contextual response      ││
│  │ - Format output with XML tags       ││
│  └──────────────┬──────────────────────┘│
│                 │                        │
│  ┌──────────────▼──────────────────────┐│
│  │ TTS Service (VOICEVOX)              ││
│  │ - Synthesize Japanese speech        ││
│  │ - Return audio file                 ││
│  └──────────────┬──────────────────────┘│
│                 │                        │
└─────────────────┼───────────────────────┘
                  │ HTTP Response (JSON + Audio URL)
                  ▼
        ┌──────────────────────┐
        │  Frontend Display    │
        │ - Chat Message       │
        │ - Avatar Animation   │
        │ - TTS Audio Playback │
        └──────────────────────┘
```

---

## 📚 Key Modules & Components

### Core LLM Service (`llm_core/`)

- **llm_service.py** – Main inference engine with Hugging Face transformers
- **semantic_cache.py** – FAISS-based vector caching for query optimization
- **output_formatter.py** – XML tag extraction and response standardization
- **agents/** – LangGraph multi-agent workflow definitions
- **chains/** – LangChain chain configurations for complex reasoning
- **prompts/** – System prompts, few-shot examples, and context injection

### Backend Services (`backend/services/`)

- **language_detector.py** – Multi-language detection with intent routing
- **voicevox_service.py** – VOICEVOX TTS integration for Japanese speech synthesis

### Data Management (`data/`)

- **FAISS Index** – Semantic search for rapid retrieval of grammar rules & vocabulary
- **Anki Decks** – Structured JLPT vocabulary learning sets
- **Grammar Data** – Comprehensive Japanese grammar rules and patterns
- **Dictionary** – JMDict Japanese-English reference database

---

## 🚀 Deployment Guide

### Local Development

```bash
# Ensure .env is configured
# Terminal 1
uvicorn backend.main:app --reload --port 8000

# Terminal 2
cd frontend && pnpm dev
```

### Production Deployment (Recommended)

#### Backend (Docker)

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Frontend (Vercel/Netlify)

```bash
cd frontend
pnpm build
vercel deploy
```

---

## 🧪 Testing & Development

### Run Jupyter Notebooks for Experimentation

```bash
# Activate the virtual environment
.\env\Scripts\Activate.ps1

# Launch Jupyter Lab
jupyter lab notebooks/
```

Available notebooks:
- **baseline.ipynb** – Performance benchmarks
- **grammar.ipynb** – Grammar rule testing
- **routing.ipynb** – Intent routing analysis
- **vocabulary.ipynb** – Vocabulary coverage analysis

### Run Comprehensive Tests

```bash
pytest test/ -v
```

---

## 📖 Documentation

Detailed documentation is available in the `docs/` directory:

- [Backend Documentation](docs/backend_documentation.md) – API endpoints, services, and architecture
- [Frontend Documentation](docs/frontend_documentation.md) – Components, hooks, and UI patterns
- [LLM Core Documentation](README_LLM_CORE.md) – AI agent configuration and prompt engineering
- [System Description](system_description.md) – Complete component registry and dependencies

---

## 🤝 Contributing

We welcome contributions and feedback from the community! Here's how you can help:

1. **Report Bugs** – Open an issue describing the problem and steps to reproduce
2. **Suggest Features** – Share your ideas for improving the learning experience
3. **Improve Documentation** – Help clarify or expand existing guides
4. **Submit Pull Requests** – Contribute code improvements with clear commit messages

### Development Workflow

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and commit
git add .
git commit -m "feat: add your feature description"

# Push to your fork
git push origin feature/your-feature-name

# Open a Pull Request on GitHub
```

---

## 🙏 Acknowledgments & Conclusion

AI NAGARI represents the culmination of dedicated research and development into intelligent language learning systems. This graduation thesis project integrates state-of-the-art technologies in:

- **Large Language Models** (LLM-based instruction)
- **Semantic Search** (FAISS vector indexing)
- **3D Character Animation** (VRM avatars)
- **Speech Synthesis** (VOICEVOX TTS)
- **Agentic AI** (LangGraph multi-agent orchestration)

We are deeply grateful to:
- Our mentors and academic advisors for their guidance
- The open-source community for invaluable libraries and tools
- All users and contributors who provide feedback and improvements

This project is offered as an **open-source initiative** to advance Japanese language education and demonstrate practical applications of modern AI technologies. Your feedback, contributions, and suggestions are highly appreciated and will help us continuously improve the learning experience.

**Thank you for using AI NAGARI!** 🙏

---

## 📄 License

This project is licensed under the **MIT License** – see the LICENSE file for details.

---

## 📞 Contact & Support

For questions, support, or collaboration opportunities, please reach out:

- **GitHub Issues** – Report bugs and feature requests
- **Email** – [contact information if provided]
- **Documentation** – Comprehensive guides available in `/docs` and `/README_*.md`

---

<div align="center">

**Made with ❤️ for language learners worldwide**

Last Updated: May 26, 2026 | Version 1.6.0

</div>