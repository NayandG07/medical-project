# Medical AI Platform

A production-grade AI medical education platform designed for medical students with a scarcity-first engineering approach.

## Features

- AI-powered tutoring and chat interface
- Study tools (flashcards, MCQs, concept maps)
- Clinical reasoning and OSCE simulation
- Document processing with RAG
- Comprehensive admin controls
- API key pool management
- Automatic maintenance mode
- Freemium rate limiting

## Architecture

- **Frontend**: Next.js (TypeScript, React)
- **Backend**: FastAPI (Python, async)
- **Database**: Supabase (Postgres + Auth + pgvector)
- **AI Providers**: Gemini Flash, open-source LLMs

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
uvicorn main:app --reload
```

Backend will run at http://localhost:8000

### Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your credentials
npm run dev
```

Frontend will run at http://localhost:3000

## Documentation

- Backend API: http://localhost:8000/docs
- Design Document: `.kiro/specs/medical-ai-platform/design.md`
- Requirements: `.kiro/specs/medical-ai-platform/requirements.md`
- Tasks: `.kiro/specs/medical-ai-platform/tasks.md`

## Testing

### Backend Tests
```bash
cd backend
pytest                              # All tests
pytest tests/property/              # Property-based tests
pytest --cov=backend --cov-report=html  # With coverage
```

### Frontend Tests
```bash
cd frontend
npm test                            # All tests
npm run test:watch                  # Watch mode
```

## Development Workflow

1. **Local Development First**: Complete functionality on localhost
2. **Phase-based Implementation**: Follow task phases in order
3. **Test-Driven**: Write tests alongside implementation
4. **Property-Based Testing**: Use Hypothesis (Python) and fast-check (TypeScript)

## Deployment (Final Phase)

- **Frontend**: Netlify
- **Backend**: Heroku
- **Database**: Supabase Cloud
- **CDN** (Optional): Cloudflare

## License

Proprietary - All rights reserved
