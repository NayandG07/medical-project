# Medical AI Platform - Backend

FastAPI backend for the Medical AI Platform.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Unix/MacOS: `source venv/bin/activate`

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

5. Run the development server:
```bash
uvicorn main:app --reload
```

The API will be available at http://localhost:8000

## API Documentation

Interactive API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Testing

Run tests with:
```bash
pytest
```

Run property-based tests:
```bash
pytest tests/property/ -m property_test
```

## Project Structure

```
backend/
├── main.py              # FastAPI application entry point
├── services/            # Business logic services
│   ├── auth.py
│   ├── chat.py
│   ├── commands.py
│   ├── rate_limiter.py
│   ├── model_router.py
│   ├── admin.py
│   └── providers/       # AI provider integrations
├── middleware/          # Custom middleware
├── database/            # Database utilities
└── tests/              # Test suite
    ├── unit/
    ├── integration/
    └── property/
```
