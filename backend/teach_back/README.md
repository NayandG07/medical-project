# Interactive Learning Assistant (Teach-Back Mode)

## Overview

The Interactive Learning Assistant is a standalone feature module that enables medical students to teach concepts back to an AI tutor through voice and/or text input. The system actively listens, detects conceptual errors, provides gentle corrections through interruptions, and conducts an oral-style examination at the end of each session.

## Architecture

### Module Structure

```
backend/teach_back/
├── __init__.py                 # Module initialization
├── models.py                   # Pydantic data models
├── data_storage.py            # Database operations
├── state_machine.py           # Session state management
├── rate_limiter.py            # Independent rate limiting
├── voice_processor.py         # STT/TTS integration
├── llm_orchestrator.py        # Multi-role LLM coordination
├── session_manager.py         # Session lifecycle management
└── roles/                     # AI role implementations
    ├── __init__.py
    ├── student_persona.py     # Curious learner role
    ├── evaluator.py           # Error detection role
    ├── controller.py          # Flow control role
    └── examiner.py            # OSCE examination role
```

### Database Schema

Six dedicated tables in PostgreSQL:
- `teach_back_sessions` - Main session data
- `teach_back_transcripts` - Complete conversation history
- `teach_back_errors` - Detected errors with corrections
- `teach_back_examinations` - Q&A from examination phase
- `teach_back_summaries` - Session summaries
- `teach_back_usage` - Rate limiting tracking

## Key Features

### 1. **Isolated Architecture**
- Completely independent module
- Can be added/removed without affecting core app
- Separate database tables and rate limits
- Dedicated API keys for LLM providers

### 2. **Multi-Modal Support**
- **Input Modes**: Text Only, Voice Only, Text+Voice Mixed
- **Output Modes**: Text Only, Voice+Text
- Automatic transcription with Whisper-large-v3
- Natural voice synthesis with Piper TTS

### 3. **Intelligent Error Detection**
- Real-time error detection during teaching
- Severity classification (minor, moderate, critical)
- Gentle, constructive interruptions
- Context-aware corrections

### 4. **State Machine**
Valid state transitions:
```
TEACHING → INTERRUPTED (error detected)
INTERRUPTED → TEACHING (user acknowledges)
TEACHING → EXAMINING (user ends teaching)
EXAMINING → COMPLETED (examination finished)
```

### 5. **Rate Limiting**
Independent quotas per plan:
- **Free**: 0 sessions (feature disabled)
- **Student**: 5 text/day, 2 voice/day
- **Pro**: 20 text/day, 10 voice/day
- **Admin**: Unlimited

Voice sessions cost 2x credits due to STT/TTS processing.

### 6. **LLM Failover**
- Primary LLM (configurable via environment)
- Fallback LLM (m42-health/Llama3-Med42-70B)
- Automatic failover on primary failure
- Maintenance mode if both fail

### 7. **Graceful Degradation**
- STT failure → automatic text-only input
- TTS failure → automatic text-only output
- User notifications for all degradations
- No silent failures

## Components

### SessionManager
Orchestrates the complete session lifecycle:
- Creates sessions with mode validation
- Processes user input (text or voice)
- Coordinates all components
- Generates comprehensive summaries

### StateMachine
Manages session state transitions:
- Validates all transitions
- Logs transitions with timestamps
- Maintains state history
- Prevents invalid transitions

### RateLimiter
Enforces independent rate limits:
- Plan-based quotas
- Voice session cost premium (2x)
- Daily usage tracking
- Quota information API

### VoiceProcessor
Handles voice input/output:
- Whisper-large-v3 for STT
- Piper TTS for voice synthesis
- Configurable model paths
- Health checks for availability

### LLMOrchestrator
Coordinates multiple AI roles:
- **StudentPersona**: Acts as curious learner
- **Evaluator**: Detects errors and triggers interruptions
- **Controller**: Manages session flow
- **Examiner**: Conducts OSCE-style examination

Filters role names from responses to maintain immersion.

### DataStorage
Handles all database operations:
- Async operations with proper error handling
- Transaction management
- Complete data persistence
- Efficient retrieval with indexes

## Configuration

### Environment Variables

```bash
# LLM Configuration
TEACH_BACK_PRIMARY_LLM_PROVIDER=openrouter
TEACH_BACK_PRIMARY_LLM_MODEL=anthropic/claude-3.5-sonnet
TEACH_BACK_PRIMARY_LLM_KEY=sk-...
TEACH_BACK_FALLBACK_LLM_KEY=hf_...

# Local Models
LOCAL_MODELS_DIR=/local_models

# Feature Flags
TEACH_BACK_ENABLED=true
TEACH_BACK_VOICE_ENABLED=true

# Database
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
```

### Model Requirements

**Whisper-large-v3** (STT):
- Size: ~3GB
- RAM: ~10GB for inference
- Location: `${LOCAL_MODELS_DIR}/stt/whisper-large-v3`

**Piper TTS**:
- Size: ~100MB
- Location: `${LOCAL_MODELS_DIR}/tts/piper`
- Voice model: en_US-lessac-medium.onnx

## Usage Example

```python
from teach_back.session_manager import SessionManager
from teach_back.models import InputMode, OutputMode

# Initialize manager
manager = SessionManager()

# Create session
result = await manager.create_session(
    user_id="user-uuid",
    user_plan="student",
    input_mode=InputMode.TEXT,
    output_mode=OutputMode.TEXT,
    topic="Cardiovascular System"
)

session_id = result["session"]["id"]

# Process user input
response = await manager.process_input(
    session_id=session_id,
    content="The heart has four chambers..."
)

# End session and get summary
summary = await manager.end_session(session_id)
```

## Testing

### Property-Based Tests
29 correctness properties tested with Hypothesis (100 iterations each):
- Mode configuration consistency
- Voice engine activation
- Universal transcript generation
- Rate limit independence
- State machine transitions
- Error detection and interruption
- LLM failover
- Graceful degradation
- And more...

Run tests:
```bash
pytest backend/tests/property/test_teach_back_properties.py -v
```

### Integration Tests
Complete session lifecycle testing:
- Text-only sessions
- Voice sessions
- Error detection and interruption
- Examination phase
- Summary generation

## API Endpoints

```
POST   /api/teach-back/sessions              # Create session
GET    /api/teach-back/sessions/{id}         # Get session details
POST   /api/teach-back/sessions/{id}/input   # Process input
POST   /api/teach-back/sessions/{id}/end     # End session
GET    /api/teach-back/sessions/{id}/transcript  # Get transcript
GET    /api/teach-back/sessions              # List sessions
GET    /api/teach-back/quota                 # Get quota info
```

## Error Codes

- `QUOTA_EXCEEDED` - User exceeded rate limit
- `STT_UNAVAILABLE` - Speech-to-text unavailable
- `STT_FAILED` - Transcription failed
- `TTS_UNAVAILABLE` - Text-to-speech unavailable
- `TTS_FAILED` - Synthesis failed
- `AUDIO_QUALITY_POOR` - Audio quality too low
- `PRIMARY_LLM_FAILED` - Primary LLM unavailable
- `FALLBACK_LLM_FAILED` - Fallback LLM unavailable
- `ALL_LLMS_FAILED` - All LLMs unavailable (maintenance mode)
- `INVALID_STATE_TRANSITION` - Invalid state change attempted
- `SESSION_NOT_FOUND` - Session doesn't exist
- `SESSION_COMPLETED` - Session already ended

## Monitoring

Key metrics to track:
- Session creation rate
- Session completion rate
- Voice processing success rate
- LLM failover frequency
- Error rate by error code
- Average session duration
- Quota utilization by plan

## Deployment

See `docs/teach_back_deployment.md` for complete deployment guide including:
- Model download instructions
- Database migration steps
- Docker configuration
- Hugging Face Spaces deployment
- Monitoring setup
- Troubleshooting guide

## License

Part of the VaidyaAI Medical Platform.
