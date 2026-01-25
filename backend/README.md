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
# Standard way
uvicorn main:app --reload

# Or use the convenient startup scripts with colored logging
# For Git Bash / Linux / macOS:
./start_server.sh

# For Windows Command Prompt:
start_server.bat

# Custom port:
./start_server.sh 8080
```

The API will be available at http://localhost:8000

## Colored Logging 🎨

The backend features beautiful colored console output for better readability:

- **Color-coded log levels**: DEBUG (Cyan), INFO (Green), WARNING (Yellow), ERROR (Red), CRITICAL (Magenta)
- **HTTP status codes**: Automatically colored (2xx=Green, 3xx=Yellow, 4xx=Red, 5xx=Magenta)
- **Enhanced context**: Timestamps, module names, and function names
- **Startup banner**: Beautiful ASCII art banner on server start

### Testing Colored Output

```bash
python test_colored_logging.py
```

### Configuration

Colored logging is configured in `config/colored_logging.py`. To adjust the log level:

```python
# In main.py
setup_colored_logging(level=logging.DEBUG)  # Show all logs
setup_colored_logging(level=logging.INFO)   # Default
setup_colored_logging(level=logging.WARNING) # Only warnings and errors
```

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
