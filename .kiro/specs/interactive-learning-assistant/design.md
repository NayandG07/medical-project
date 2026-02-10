# Design Document: Interactive Learning Assistant (Teach-Back Mode)

## Overview

The Interactive Learning Assistant (Teach-Back Mode) is a standalone feature module that enables medical students to practice teaching concepts back to an AI tutor. The system simulates the experience of teaching a junior medical student while being evaluated by an OSCE examiner. The feature supports multiple input/output modes (text, voice, or mixed), provides real-time error detection with gentle interruptions, and concludes with an oral examination phase.

This design follows a scarcity-first engineering approach, with graceful degradation when services fail, independent rate limiting, and loose coupling to ensure the feature can be added or removed without affecting the core application.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                        │
│  ┌──────────────────────────────────────────────────────────┤
│  │  Teach-Back UI (Separate Entry Point)                    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  │Mode      │  │Live      │  │Session   │              │
│  │  │Selectors │  │Transcript│  │Summary   │              │
│  │  └──────────┘  └──────────┘  └──────────┘              │
│  └──────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND (FastAPI Gateway)                    │
│  ┌──────────────────────────────────────────────────────────┤
│  │  teach_back/ Module (Isolated)                           │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  │Session   │  │State     │  │Rate      │              │
│  │  │Manager   │  │Machine   │  │Limiter   │              │
│  │  └──────────┘  └──────────┘  └──────────┘              │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  │Voice     │  │LLM       │  │Data      │              │
│  │  │Processor │  │Orchestrator│ │Storage   │              │
│  │  └──────────┘  └──────────┘  └──────────┘              │
│  └──────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Model Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              LOCAL MODELS (/local_models/)                   │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ stt/         │  │ tts/         │                        │
│  │ Whisper-v3   │  │ Piper TTS    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              EXTERNAL LLM PROVIDERS                          │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Primary LLM  │  │ Fallback LLM │                        │
│  │ (models.json)│  │ (Med42-70B)  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
backend/
├── teach_back/
│   ├── __init__.py
│   ├── models.py              # Session, Transcript, Error data models
│   ├── session_manager.py     # Session lifecycle management
│   ├── state_machine.py       # Session state transitions
│   ├── rate_limiter.py        # Independent rate limiting
│   ├── voice_processor.py     # STT/TTS integration
│   ├── llm_orchestrator.py    # Multi-role LLM coordination
│   ├── roles/
│   │   ├── __init__.py
│   │   ├── student_persona.py # Student role implementation
│   │   ├── evaluator.py       # Error detection role
│   │   ├── controller.py      # Session flow control
│   │   └── examiner.py        # Oral examination role
│   ├── data_storage.py        # Session data persistence
│   └── integrations.py        # Data feeds to existing systems
│
├── local_models/
│   ├── stt/
│   │   └── whisper-large-v3/  # Speech-to-text model
│   └── tts/
│       └── piper/             # Text-to-speech model
│
frontend/
└── app/
    └── teach-back/
        ├── page.tsx           # Main teach-back UI
        ├── components/
        │   ├── ModeSelector.tsx
        │   ├── LiveTranscript.tsx
        │   ├── InterruptionIndicator.tsx
        │   └── SessionSummary.tsx
        └── hooks/
            └── useTeachBackSession.ts
```

## Components and Interfaces

### 1. Session Manager

**Responsibility**: Manages the complete lifecycle of teach-back sessions

**Interface**:
```python
class SessionManager:
    def create_session(
        self,
        user_id: str,
        input_mode: InputMode,
        output_mode: OutputMode
    ) -> Session
    
    def get_session(self, session_id: str) -> Session
    
    def end_session(self, session_id: str) -> SessionSummary
    
    def process_input(
        self,
        session_id: str,
        content: str,
        is_voice: bool = False
    ) -> Response
```

**Key Behaviors**:
- Creates new sessions with selected modes
- Validates mode compatibility with user plan
- Coordinates with state machine for transitions
- Delegates to LLM orchestrator for responses
- Generates session summaries on completion

---

### 2. State Machine

**Responsibility**: Manages session state transitions and validates state-specific operations

**States**:
```python
class SessionState(Enum):
    TEACHING = "teaching"           # User is teaching content
    INTERRUPTED = "interrupted"     # System has interrupted with correction
    EXAMINING = "examining"         # Oral examination phase
    COMPLETED = "completed"         # Session ended
```

**State Transitions**:
```
TEACHING → INTERRUPTED (error detected)
INTERRUPTED → TEACHING (user acknowledges)
TEACHING → EXAMINING (user ends teaching)
EXAMINING → COMPLETED (examination finished)
```

**Interface**:
```python
class StateMachine:
    def transition(
        self,
        session_id: str,
        from_state: SessionState,
        to_state: SessionState,
        reason: str
    ) -> bool
    
    def get_current_state(self, session_id: str) -> SessionState
    
    def can_transition(
        self,
        from_state: SessionState,
        to_state: SessionState
    ) -> bool
```

---

### 3. Voice Processor

**Responsibility**: Handles speech-to-text and text-to-speech processing

**Interface**:
```python
class VoiceProcessor:
    def __init__(self, models_dir: str = "/local_models"):
        self.stt_model_path = f"{models_dir}/stt/whisper-large-v3"
        self.tts_model_path = f"{models_dir}/tts/piper"
    
    async def transcribe_audio(
        self,
        audio_data: bytes,
        language: str = "en"
    ) -> TranscriptionResult
    
    async def synthesize_speech(
        self,
        text: str,
        voice: str = "default"
    ) -> AudioResult
    
    def is_stt_available(self) -> bool
    
    def is_tts_available(self) -> bool
```

**Failure Handling**:
- STT failure → Return error, session falls back to text input
- TTS failure → Return error, session falls back to text output
- Both failures → Session continues in text-only mode

**Model Loading**:
- Models loaded lazily on first use
- Paths constructed from configuration, not hardcoded
- Model availability checked before session creation

---

### 4. LLM Orchestrator

**Responsibility**: Coordinates multiple AI roles to generate appropriate responses

**Interface**:
```python
class LLMOrchestrator:
    def __init__(self, primary_llm_config: dict, fallback_llm_config: dict):
        self.primary_llm = self._init_primary_llm(primary_llm_config)
        self.fallback_llm = self._init_fallback_llm(fallback_llm_config)
        self.roles = {
            "student": StudentPersona(),
            "evaluator": Evaluator(),
            "controller": Controller(),
            "examiner": Examiner()
        }
    
    async def generate_response(
        self,
        session: Session,
        user_input: str,
        current_state: SessionState
    ) -> OrchestratedResponse
    
    async def detect_errors(
        self,
        session: Session,
        user_input: str
    ) -> List[DetectedError]
    
    async def generate_examination_question(
        self,
        session: Session,
        taught_content: List[str]
    ) -> ExaminationQuestion
```

**Role Coordination**:
1. **Teaching State**: Student Persona generates curious questions, Evaluator checks for errors
2. **Interrupted State**: Evaluator provides gentle correction
3. **Examining State**: Examiner generates questions based on taught content
4. **All States**: Controller manages flow and decides when to transition

**LLM Fallback Logic**:
```python
async def _call_llm(self, prompt: str, role: str) -> str:
    try:
        response = await self.primary_llm.generate(prompt)
        return response
    except Exception as e:
        logger.warning(f"Primary LLM failed: {e}, falling back")
        try:
            response = await self.fallback_llm.generate(prompt)
            return response
        except Exception as e:
            logger.error(f"Both LLMs failed: {e}")
            raise LLMFailureException("All LLM providers unavailable")
```

---

### 5. Role Implementations

#### Student Persona

**Responsibility**: Acts as a junior medical student being taught

**Behavior**:
- Asks clarifying questions when explanation is unclear
- Shows enthusiasm for learning
- Requests examples when concepts are abstract
- Simulates realistic student responses

**Prompt Template**:
```
You are a junior medical student being taught by a peer. You are eager to learn but sometimes need clarification. The student is teaching you about: {topic}

Their latest explanation: {user_input}

Respond as a curious student would. If something is unclear, ask for clarification. If it's clear, acknowledge and ask a follow-up question to deepen understanding.
```

#### Evaluator

**Responsibility**: Detects conceptual errors and triggers interruptions

**Behavior**:
- Continuously monitors user's teaching for errors
- Identifies: factual errors, incomplete explanations, misconceptions
- Generates gentle, constructive corrections
- Tracks error patterns for summary

**Error Detection Prompt**:
```
You are evaluating a medical student's teaching. Identify any factual errors, misconceptions, or incomplete explanations.

Topic: {topic}
Student's explanation: {user_input}
Previous context: {conversation_history}

If there are errors, list them with:
1. The specific error
2. The correct information
3. Why this matters clinically

If the explanation is accurate, respond with "NO_ERRORS".
```

#### Controller

**Responsibility**: Manages session flow and state transitions

**Behavior**:
- Decides when to interrupt for errors
- Determines when teaching phase should end
- Triggers examination phase
- Manages pacing of interaction

**Decision Logic**:
```python
def should_interrupt(self, errors: List[DetectedError]) -> bool:
    # Interrupt for critical errors immediately
    critical_errors = [e for e in errors if e.severity == "critical"]
    if critical_errors:
        return True
    
    # Accumulate minor errors, interrupt after threshold
    if len(errors) >= 3:
        return True
    
    return False
```

#### Examiner

**Responsibility**: Conducts oral examination at session end

**Behavior**:
- Generates questions based on taught content
- Focuses on areas with errors or gaps
- Evaluates user responses
- Provides performance feedback

**Question Generation Prompt**:
```
You are an OSCE examiner. The student has just taught you about: {topic}

Areas where they made errors: {error_summary}
Areas they covered well: {strong_areas}

Generate 3-5 examination questions that:
1. Test understanding of areas where errors occurred
2. Probe depth of knowledge in well-covered areas
3. Follow OSCE examination style (clear, focused, clinically relevant)
```

---

### 6. Rate Limiter

**Responsibility**: Enforces teach-back specific rate limits

**Rate Limit Structure**:
```python
TEACH_BACK_LIMITS = {
    "free": {
        "sessions_per_day": 0,  # Feature disabled
        "voice_sessions_per_day": 0
    },
    "student": {
        "sessions_per_day": 5,
        "voice_sessions_per_day": 2,
        "max_session_duration_minutes": 30
    },
    "pro": {
        "sessions_per_day": 20,
        "voice_sessions_per_day": 10,
        "max_session_duration_minutes": 60
    },
    "admin": {
        # Unlimited
    }
}
```

**Interface**:
```python
class TeachBackRateLimiter:
    def check_session_limit(
        self,
        user_id: str,
        is_voice: bool
    ) -> RateLimitResult
    
    def increment_session_count(
        self,
        user_id: str,
        is_voice: bool
    ) -> None
    
    def get_remaining_quota(
        self,
        user_id: str
    ) -> QuotaInfo
```

**Cost Calculation**:
- Text-only session: 1 session credit
- Voice session: 2 session credits (due to STT/TTS costs)
- Mixed mode: 2 session credits

---

### 7. Data Storage

**Responsibility**: Persists session data and provides retrieval interface

**Database Schema**:

```sql
-- Teach-back sessions table
CREATE TABLE teach_back_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    topic TEXT,
    input_mode VARCHAR(20) NOT NULL,  -- 'text', 'voice', 'mixed'
    output_mode VARCHAR(20) NOT NULL, -- 'text', 'voice_text'
    state VARCHAR(20) NOT NULL,       -- 'teaching', 'interrupted', 'examining', 'completed'
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Transcripts table
CREATE TABLE teach_back_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL,     -- 'user', 'system'
    content TEXT NOT NULL,
    is_voice BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Detected errors table
CREATE TABLE teach_back_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    error_text TEXT NOT NULL,
    correction TEXT NOT NULL,
    context TEXT,
    severity VARCHAR(20),             -- 'minor', 'moderate', 'critical'
    detected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Examination Q&A table
CREATE TABLE teach_back_examinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    user_answer TEXT,
    evaluation TEXT,
    score INTEGER,                    -- 0-10 scale
    asked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Session summaries table
CREATE TABLE teach_back_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    total_errors INTEGER NOT NULL,
    missed_concepts TEXT[],
    strong_areas TEXT[],
    recommendations TEXT[],
    overall_score INTEGER,            -- 0-100 scale
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Rate limiting table
CREATE TABLE teach_back_usage (
    user_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    text_sessions INTEGER DEFAULT 0,
    voice_sessions INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date)
);
```

**Interface**:
```python
class DataStorage:
    async def save_session(self, session: Session) -> str
    
    async def save_transcript_entry(
        self,
        session_id: str,
        speaker: str,
        content: str,
        is_voice: bool
    ) -> None
    
    async def save_error(
        self,
        session_id: str,
        error: DetectedError
    ) -> None
    
    async def save_examination_qa(
        self,
        session_id: str,
        question: str,
        answer: str,
        evaluation: str,
        score: int
    ) -> None
    
    async def save_summary(
        self,
        session_id: str,
        summary: SessionSummary
    ) -> None
    
    async def get_session_transcript(
        self,
        session_id: str
    ) -> List[TranscriptEntry]
    
    async def get_user_sessions(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[Session]
```

---

### 8. Integration Layer

**Responsibility**: Feeds teach-back data into existing systems

**Integration Points**:

```python
class TeachBackIntegrations:
    async def feed_to_flashcard_generator(
        self,
        session_id: str
    ) -> None:
        """
        Sends missed concepts and weak areas to flashcard generator
        for automatic flashcard creation suggestions
        """
        summary = await self.data_storage.get_summary(session_id)
        missed_concepts = summary.missed_concepts
        
        # Call existing flashcard system
        await flashcard_service.suggest_flashcards(
            user_id=summary.user_id,
            topics=missed_concepts,
            source="teach_back"
        )
    
    async def feed_to_weak_area_analysis(
        self,
        session_id: str
    ) -> None:
        """
        Sends error patterns to weak-area analysis system
        """
        errors = await self.data_storage.get_session_errors(session_id)
        
        # Extract topics from errors
        weak_topics = self._extract_topics_from_errors(errors)
        
        # Call existing weak-area system
        await weak_area_service.record_weak_areas(
            user_id=session.user_id,
            topics=weak_topics,
            source="teach_back"
        )
    
    async def feed_to_study_planner(
        self,
        session_id: str
    ) -> None:
        """
        Sends recommendations to study planner
        """
        summary = await self.data_storage.get_summary(session_id)
        
        # Call existing study planner
        await study_planner_service.add_recommendations(
            user_id=summary.user_id,
            recommendations=summary.recommendations,
            source="teach_back"
        )
    
    async def feed_to_mcq_suggestions(
        self,
        session_id: str
    ) -> None:
        """
        Sends missed concepts to MCQ suggestion system
        """
        summary = await self.data_storage.get_summary(session_id)
        
        # Call existing MCQ system
        await mcq_service.suggest_mcqs(
            user_id=summary.user_id,
            topics=summary.missed_concepts,
            source="teach_back"
        )
```

**Integration Principles**:
- Loose coupling: Uses defined interfaces, not direct imports
- Async: All integrations are non-blocking
- Failure isolation: Integration failures don't affect teach-back session
- Optional: Integrations can be disabled without breaking teach-back

---

## Data Models

### Session Model

```python
from enum import Enum
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class InputMode(str, Enum):
    TEXT = "text"
    VOICE = "voice"
    MIXED = "mixed"

class OutputMode(str, Enum):
    TEXT = "text"
    VOICE_TEXT = "voice_text"

class SessionState(str, Enum):
    TEACHING = "teaching"
    INTERRUPTED = "interrupted"
    EXAMINING = "examining"
    COMPLETED = "completed"

class Session(BaseModel):
    id: str
    user_id: str
    topic: Optional[str] = None
    input_mode: InputMode
    output_mode: OutputMode
    state: SessionState
    started_at: datetime
    ended_at: Optional[datetime] = None
    
    class Config:
        use_enum_values = True
```

### Transcript Entry Model

```python
class TranscriptEntry(BaseModel):
    id: str
    session_id: str
    speaker: str  # 'user' or 'system'
    content: str
    is_voice: bool
    timestamp: datetime
```

### Detected Error Model

```python
class ErrorSeverity(str, Enum):
    MINOR = "minor"
    MODERATE = "moderate"
    CRITICAL = "critical"

class DetectedError(BaseModel):
    id: str
    session_id: str
    error_text: str
    correction: str
    context: Optional[str] = None
    severity: ErrorSeverity
    detected_at: datetime
```

### Examination Q&A Model

```python
class ExaminationQA(BaseModel):
    id: str
    session_id: str
    question: str
    user_answer: Optional[str] = None
    evaluation: Optional[str] = None
    score: Optional[int] = None  # 0-10 scale
    asked_at: datetime
```

### Session Summary Model

```python
class SessionSummary(BaseModel):
    id: str
    session_id: str
    user_id: str
    total_errors: int
    missed_concepts: List[str]
    strong_areas: List[str]
    recommendations: List[str]
    overall_score: int  # 0-100 scale
    created_at: datetime
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies and consolidation opportunities:

**Redundancy Group 1: Mode Configuration**
- Properties 1.3 and 1.4 both test mode configuration
- **Consolidation**: Combine into single property testing both input and output mode configuration

**Redundancy Group 2: Transcript Generation**
- Properties 2.1, 2.2, 2.3, 2.4, 2.5 all relate to transcript completeness
- **Consolidation**: Combine into comprehensive transcript round-trip property

**Redundancy Group 3: State Transitions**
- Properties 13.4, 13.5, 16.2, 16.3 overlap on interruption state transitions
- Properties 14.1, 16.4, 16.5 overlap on examination state transitions
- **Consolidation**: Combine into comprehensive state machine property

**Redundancy Group 4: Data Persistence**
- Properties 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7 all test data storage
- **Consolidation**: Combine into session data round-trip property

**Redundancy Group 5: Failure Handling**
- Properties 9.1, 9.2, 9.3, 9.4, 9.5, 9.6 all test graceful degradation
- **Consolidation**: Combine into comprehensive failure handling property

**Redundancy Group 6: Summary Generation**
- Properties 19.1, 19.2, 19.3, 19.4 all test summary completeness
- **Consolidation**: Combine into single summary completeness property

**Redundancy Group 7: Integration**
- Properties 11.1, 11.2, 11.3, 11.4 all test data feeds to other systems
- **Consolidation**: Combine into single integration property

After reflection, reducing from 60+ potential properties to 25 unique, non-redundant properties.

### Correctness Properties

Property 1: Mode Configuration Consistency
*For any* session creation request with selected input and output modes, the created session should be configured to accept input via the selected input method and provide output via the selected output method
**Validates: Requirements 1.3, 1.4**

Property 2: Voice Mode Engine Activation
*For any* session with Voice Only or Text+Voice Mixed input mode, the STT_Engine should be activated; for any session with Voice+Text output mode, the TTS_Engine should be activated
**Validates: Requirements 1.5, 1.6**

Property 3: Universal Transcript Generation
*For any* session regardless of input or output mode, a complete text transcript should be generated containing all user inputs (converted from voice if necessary), all system responses, and all interruptions, with each entry timestamped
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 4: Rate Limit Independence
*For any* teach-back session usage, the rate quota consumed should not affect other feature quotas, and other feature usage should not affect teach-back quotas
**Validates: Requirements 3.4, 8.1**

Property 5: Internal Role Opacity
*For any* system response generated during a session, the response text should not contain internal role names (Student_Persona, Evaluator, Controller, Examiner)
**Validates: Requirements 4.5**

Property 6: State-Based Role Selection
*For any* session in teaching state, responses should use Student_Persona or Evaluator roles; for any session in examining state, responses should use Examiner role
**Validates: Requirements 4.6**

Property 7: LLM Failover
*For any* request where the Primary_LLM fails, the system should automatically attempt the request with the Fallback_LLM without user intervention
**Validates: Requirements 5.2**

Property 8: Resource Isolation
*For any* teach-back session, the LLM API keys and quotas used should be distinct from those used by other features, ensuring no quota sharing
**Validates: Requirements 5.6**

Property 9: Model Path Construction
*For any* model loading operation, the constructed path should be relative to the Local_Models_Directory configuration value, not hardcoded
**Validates: Requirements 6.5**

Property 10: Voice Session Cost Premium
*For any* voice-based session (Voice Only or Text+Voice Mixed input, or Voice+Text output), the quota deducted should be greater than the quota deducted for a text-only session
**Validates: Requirements 8.2**

Property 11: Quota Enforcement
*For any* user who has exceeded their Rate_Quota, attempts to create new sessions should be rejected with quota information displayed
**Validates: Requirements 8.6**

Property 12: STT Failure Fallback
*For any* session where the STT_Engine fails, the system should automatically switch to text-only input mode and notify the user of the degradation
**Validates: Requirements 9.1, 17.6**

Property 13: TTS Failure Fallback
*For any* session where the TTS_Engine fails, the system should automatically switch to text-only output mode and notify the user of the degradation
**Validates: Requirements 9.2, 18.5**

Property 14: LLM Failure Handling
*For any* session where the Primary_LLM fails, the system should pause the session and notify the user; if both Primary_LLM and Fallback_LLM fail, the system should enter Maintenance_Mode
**Validates: Requirements 9.3, 9.4**

Property 15: No Silent Degradation
*For any* service failure that causes functionality degradation, a user notification should be generated; no degradation should occur without notification
**Validates: Requirements 9.5**

Property 16: Recovery Logging
*For any* service that recovers from a failed state, the recovery should be logged and normal operation should resume automatically
**Validates: Requirements 9.6**

Property 17: Session Data Round-Trip
*For any* completed session, retrieving the session from storage should return the complete transcript, all detected errors with context and corrections, all missed concepts, all interruption points with timestamps, all examination Q&As, and all recommendations
**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7**

Property 18: Integration Data Propagation
*For any* completed session, the session data should be provided to the flashcard generator, weak-area analysis system, study planner, and MCQ suggestion system through their defined interfaces
**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

Property 19: Retention Policy Enforcement
*For any* session data older than the user's plan retention timeframe, the data should be automatically deleted while preserving summary statistics, and the deletion should be logged
**Validates: Requirements 12.2, 12.4, 12.5**

Property 20: Retention Policy Updates
*For any* user whose plan changes, the new retention policy should be applied to their existing session data
**Validates: Requirements 12.3**

Property 21: Error Detection Triggers Interruption
*For any* conceptual error detected by the Evaluator, an interruption should be generated containing the correct information, and the session state should transition to interrupted
**Validates: Requirements 13.1, 13.3, 13.4, 13.6**

Property 22: Interruption Acknowledgment Recovery
*For any* session in interrupted state, when the user acknowledges the interruption, the session state should transition back to teaching
**Validates: Requirements 13.5**

Property 23: State Machine Transitions
*For any* new session, the initial state should be teaching; when teaching ends, state should transition to examining; when examination completes, state should transition to completed; all transitions should be logged with timestamps
**Validates: Requirements 16.1, 16.4, 16.5, 16.6, 14.1**

Property 24: Examination Question Targeting
*For any* examination phase, the questions generated should relate to concepts that were taught incorrectly or incompletely during the teaching phase
**Validates: Requirements 14.3**

Property 25: Examination Evaluation and Storage
*For any* examination question answered by the user, the response should be evaluated, and both the question and answer with evaluation should be stored in session data
**Validates: Requirements 14.4, 14.6**

Property 26: Session Summary Completeness
*For any* completed session, the generated summary should include all detected errors, all missed concepts, personalized study recommendations, and examination performance metrics
**Validates: Requirements 19.1, 19.2, 19.3, 19.4**

Property 27: Voice Input Transcription
*For any* audio input in Voice Only or Text+Voice Mixed mode, the audio should be processed through STT_Engine to generate text, and the transcribed text should appear in the session transcript
**Validates: Requirements 17.1, 17.2, 17.3**

Property 28: Voice Output Generation
*For any* system response in Voice+Text output mode, the response text should be processed through TTS_Engine to generate audio output
**Validates: Requirements 18.1, 18.2**

Property 29: Configuration Validation
*For any* configuration loaded at startup, invalid configuration values should be rejected and errors should be logged
**Validates: Requirements 20.6**

## Error Handling

### Error Categories

**1. Voice Processing Errors**
- STT engine unavailable or fails to load
- Audio input quality too poor to transcribe
- TTS engine unavailable or fails to load
- Audio output generation fails

**Handling Strategy**:
- Graceful degradation to text-only mode
- User notification of degradation
- Session continues without interruption
- Error logged for monitoring

**2. LLM Provider Errors**
- Primary LLM API unavailable
- Primary LLM rate limit exceeded
- Fallback LLM unavailable
- Both LLMs fail

**Handling Strategy**:
- Automatic failover to Fallback LLM
- Session pause on total failure
- User notification with retry options
- Maintenance mode if persistent
- Error logged with provider details

**3. Rate Limit Errors**
- User exceeds daily session quota
- User exceeds voice session quota
- Session duration exceeds plan limit

**Handling Strategy**:
- Prevent session creation
- Display clear quota information
- Suggest plan upgrade
- Log quota violation

**4. State Machine Errors**
- Invalid state transition attempted
- State corruption detected
- Concurrent state modification

**Handling Strategy**:
- Reject invalid transitions
- Log error with context
- Maintain current valid state
- Notify user if action blocked

**5. Data Persistence Errors**
- Database connection failure
- Transaction rollback
- Storage quota exceeded

**Handling Strategy**:
- Retry with exponential backoff
- Cache data temporarily if DB unavailable
- Notify user of persistence failure
- Log error for admin attention

**6. Integration Errors**
- External system unavailable
- Integration API failure
- Data format mismatch

**Handling Strategy**:
- Queue data for retry
- Continue session without blocking
- Log integration failure
- Retry asynchronously

### Error Response Format

All errors returned to the frontend follow this structure:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: any;          // Optional additional context
    recoverable: boolean;   // Whether user can retry
    fallback_active?: boolean; // Whether fallback mode is active
  };
}
```

### Error Codes

```python
class ErrorCode(str, Enum):
    # Voice processing
    STT_UNAVAILABLE = "stt_unavailable"
    STT_FAILED = "stt_failed"
    TTS_UNAVAILABLE = "tts_unavailable"
    TTS_FAILED = "tts_failed"
    AUDIO_QUALITY_POOR = "audio_quality_poor"
    
    # LLM providers
    PRIMARY_LLM_FAILED = "primary_llm_failed"
    FALLBACK_LLM_FAILED = "fallback_llm_failed"
    ALL_LLMS_FAILED = "all_llms_failed"
    LLM_RATE_LIMIT = "llm_rate_limit"
    
    # Rate limiting
    QUOTA_EXCEEDED = "quota_exceeded"
    VOICE_QUOTA_EXCEEDED = "voice_quota_exceeded"
    SESSION_DURATION_EXCEEDED = "session_duration_exceeded"
    
    # State machine
    INVALID_STATE_TRANSITION = "invalid_state_transition"
    STATE_CORRUPTION = "state_corruption"
    
    # Data persistence
    DATABASE_ERROR = "database_error"
    STORAGE_QUOTA_EXCEEDED = "storage_quota_exceeded"
    
    # Integration
    INTEGRATION_FAILED = "integration_failed"
    
    # Maintenance
    MAINTENANCE_MODE = "maintenance_mode"
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Specific mode selection scenarios
- Error handling for known failure cases
- UI component rendering
- Database schema validation
- API endpoint responses

**Property-Based Tests**: Verify universal properties across all inputs
- Session lifecycle properties
- State machine transitions
- Data persistence round-trips
- Failure handling across all failure types
- Quota enforcement across all plans

### Property-Based Testing Configuration

**Library Selection**: 
- Python backend: Hypothesis
- TypeScript frontend: fast-check

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: interactive-learning-assistant, Property {number}: {property_text}`
- Generators for: sessions, modes, states, errors, transcripts, summaries

**Example Property Test Structure**:

```python
from hypothesis import given, strategies as st
import pytest

@given(
    input_mode=st.sampled_from(['text', 'voice', 'mixed']),
    output_mode=st.sampled_from(['text', 'voice_text'])
)
@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 1: Mode Configuration Consistency")
def test_mode_configuration_consistency(input_mode, output_mode):
    """
    Property 1: For any session creation request with selected input and output modes,
    the created session should be configured to accept input via the selected input method
    and provide output via the selected output method
    """
    session = create_session(
        user_id="test_user",
        input_mode=input_mode,
        output_mode=output_mode
    )
    
    assert session.input_mode == input_mode
    assert session.output_mode == output_mode
    
    # Verify engines activated correctly
    if input_mode in ['voice', 'mixed']:
        assert session.stt_engine_active
    if output_mode == 'voice_text':
        assert session.tts_engine_active
```

### Unit Test Coverage Areas

**1. Mode Selection UI**
- Test that mode selectors render correctly
- Test that mode changes update session configuration
- Test that invalid mode combinations are rejected

**2. Voice Processing**
- Test STT with sample audio files
- Test TTS with sample text
- Test fallback when engines unavailable
- Test audio quality validation

**3. LLM Orchestration**
- Test role selection for each state
- Test failover from primary to fallback
- Test response generation for each role
- Test error detection logic

**4. State Machine**
- Test all valid state transitions
- Test rejection of invalid transitions
- Test state persistence across requests
- Test concurrent state access

**5. Data Persistence**
- Test session creation and retrieval
- Test transcript storage and retrieval
- Test error storage with all fields
- Test summary generation

**6. Rate Limiting**
- Test quota enforcement for each plan
- Test voice session cost premium
- Test quota reset logic
- Test admin overrides

**7. Integration**
- Test data feeds to each external system
- Test integration failure handling
- Test async retry logic
- Test data format compatibility

**8. Error Handling**
- Test each error code generation
- Test error response format
- Test user notifications
- Test error logging

### Integration Testing

**End-to-End Scenarios**:
1. Complete text-only session from start to summary
2. Complete voice session with interruptions
3. Session with STT failure mid-session
4. Session with LLM failover
5. Session hitting quota limit
6. Session with all integrations active

**Performance Testing**:
- Session creation latency
- Voice processing latency (STT + TTS)
- LLM response time
- Database query performance
- Concurrent session handling

### Test Data Generators

**Session Generator**:
```python
@st.composite
def session_strategy(draw):
    return Session(
        id=draw(st.uuids()),
        user_id=draw(st.uuids()),
        topic=draw(st.text(min_size=5, max_size=100)),
        input_mode=draw(st.sampled_from(InputMode)),
        output_mode=draw(st.sampled_from(OutputMode)),
        state=draw(st.sampled_from(SessionState)),
        started_at=draw(st.datetimes()),
        ended_at=draw(st.one_of(st.none(), st.datetimes()))
    )
```

**Error Generator**:
```python
@st.composite
def error_strategy(draw):
    return DetectedError(
        id=draw(st.uuids()),
        session_id=draw(st.uuids()),
        error_text=draw(st.text(min_size=10, max_size=200)),
        correction=draw(st.text(min_size=10, max_size=200)),
        context=draw(st.one_of(st.none(), st.text(max_size=500))),
        severity=draw(st.sampled_from(ErrorSeverity)),
        detected_at=draw(st.datetimes())
    )
```

**Transcript Generator**:
```python
@st.composite
def transcript_strategy(draw):
    return TranscriptEntry(
        id=draw(st.uuids()),
        session_id=draw(st.uuids()),
        speaker=draw(st.sampled_from(['user', 'system'])),
        content=draw(st.text(min_size=5, max_size=500)),
        is_voice=draw(st.booleans()),
        timestamp=draw(st.datetimes())
    )
```

### Continuous Testing

**Pre-commit Hooks**:
- Run unit tests on changed files
- Run linting and type checking
- Verify no hardcoded paths

**CI/CD Pipeline**:
- Run full unit test suite
- Run property tests (100 iterations)
- Run integration tests
- Check code coverage (target: 80%+)
- Run security scans

**Monitoring in Production**:
- Track error rates by error code
- Monitor LLM failover frequency
- Track voice processing success rates
- Monitor session completion rates
- Alert on maintenance mode triggers

## Deployment Considerations

### Environment Variables

```bash
# LLM Configuration
TEACH_BACK_PRIMARY_LLM_PROVIDER=openrouter
TEACH_BACK_PRIMARY_LLM_KEY=sk-...
TEACH_BACK_FALLBACK_LLM_PROVIDER=huggingface
TEACH_BACK_FALLBACK_LLM_KEY=hf_...

# Local Models Directory
LOCAL_MODELS_DIR=/local_models

# Rate Limiting
TEACH_BACK_RATE_LIMITS_CONFIG=/config/teach_back_limits.json

# Data Retention
TEACH_BACK_RETENTION_CONFIG=/config/teach_back_retention.json

# Feature Flags
TEACH_BACK_ENABLED=true
TEACH_BACK_VOICE_ENABLED=true

# Integration Endpoints
FLASHCARD_SERVICE_URL=http://localhost:8000/api/flashcards
WEAK_AREA_SERVICE_URL=http://localhost:8000/api/weak-areas
STUDY_PLANNER_SERVICE_URL=http://localhost:8000/api/study-planner
MCQ_SERVICE_URL=http://localhost:8000/api/mcqs
```

### Database Migrations

```sql
-- Migration: Create teach-back tables
-- Version: 001
-- Date: 2024-01-XX

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create teach_back_sessions table
CREATE TABLE teach_back_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT,
    input_mode VARCHAR(20) NOT NULL CHECK (input_mode IN ('text', 'voice', 'mixed')),
    output_mode VARCHAR(20) NOT NULL CHECK (output_mode IN ('text', 'voice_text')),
    state VARCHAR(20) NOT NULL CHECK (state IN ('teaching', 'interrupted', 'examining', 'completed')),
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_teach_back_sessions_user_id ON teach_back_sessions(user_id);
CREATE INDEX idx_teach_back_sessions_state ON teach_back_sessions(state);
CREATE INDEX idx_teach_back_sessions_created_at ON teach_back_sessions(created_at);

-- Create teach_back_transcripts table
CREATE TABLE teach_back_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL CHECK (speaker IN ('user', 'system')),
    content TEXT NOT NULL,
    is_voice BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teach_back_transcripts_session_id ON teach_back_transcripts(session_id);
CREATE INDEX idx_teach_back_transcripts_timestamp ON teach_back_transcripts(timestamp);

-- Create teach_back_errors table
CREATE TABLE teach_back_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    error_text TEXT NOT NULL,
    correction TEXT NOT NULL,
    context TEXT,
    severity VARCHAR(20) CHECK (severity IN ('minor', 'moderate', 'critical')),
    detected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teach_back_errors_session_id ON teach_back_errors(session_id);
CREATE INDEX idx_teach_back_errors_severity ON teach_back_errors(severity);

-- Create teach_back_examinations table
CREATE TABLE teach_back_examinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    user_answer TEXT,
    evaluation TEXT,
    score INTEGER CHECK (score >= 0 AND score <= 10),
    asked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teach_back_examinations_session_id ON teach_back_examinations(session_id);

-- Create teach_back_summaries table
CREATE TABLE teach_back_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    total_errors INTEGER NOT NULL DEFAULT 0,
    missed_concepts TEXT[],
    strong_areas TEXT[],
    recommendations TEXT[],
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teach_back_summaries_session_id ON teach_back_summaries(session_id);

-- Create teach_back_usage table for rate limiting
CREATE TABLE teach_back_usage (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    text_sessions INTEGER DEFAULT 0,
    voice_sessions INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_teach_back_usage_date ON teach_back_usage(date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to teach_back_sessions
CREATE TRIGGER update_teach_back_sessions_updated_at
    BEFORE UPDATE ON teach_back_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### Model Download Script

```bash
#!/bin/bash
# download_models.sh - Download required local models

set -e

MODELS_DIR="${LOCAL_MODELS_DIR:-/local_models}"

echo "Creating model directories..."
mkdir -p "$MODELS_DIR/stt"
mkdir -p "$MODELS_DIR/tts"

echo "Downloading Whisper-large-v3 for STT..."
cd "$MODELS_DIR/stt"
# Download from Hugging Face
huggingface-cli download openai/whisper-large-v3 --local-dir whisper-large-v3

echo "Downloading Piper TTS..."
cd "$MODELS_DIR/tts"
# Download Piper TTS model
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz
rm piper_linux_x86_64.tar.gz

# Download voice model
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

echo "Model download complete!"
echo "Models installed in: $MODELS_DIR"
```

### Docker Configuration

```dockerfile
# Dockerfile additions for teach-back feature

# Install audio processing dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python audio libraries
RUN pip install \
    openai-whisper \
    piper-tts \
    soundfile \
    librosa

# Create models directory
RUN mkdir -p /local_models/stt /local_models/tts

# Copy models (if bundling in image)
# COPY local_models/ /local_models/

# Set environment variable
ENV LOCAL_MODELS_DIR=/local_models
```

### Hugging Face Spaces Deployment

For deployment to Hugging Face Spaces, ensure:

1. **Model Storage**: All models in `/local_models/` directory
2. **Configuration**: Use environment variables, not hardcoded paths
3. **Dependencies**: Include all audio processing libraries in requirements.txt
4. **Secrets**: Store API keys in Hugging Face Spaces secrets
5. **Resource Limits**: Monitor memory usage (Whisper-large-v3 requires ~10GB RAM)

```yaml
# spaces.yml
title: Medical AI Platform - Teach-Back Mode
emoji: 🩺
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
license: mit
```

### Monitoring and Alerts

**Key Metrics to Monitor**:
- Session creation rate
- Session completion rate
- Voice processing success rate
- LLM failover frequency
- Error rate by error code
- Average session duration
- Quota utilization by plan
- Integration success rate

**Alert Thresholds**:
- Error rate > 5%: Warning
- Error rate > 10%: Critical
- LLM failover rate > 20%: Warning
- Voice processing failure > 15%: Warning
- Session completion rate < 80%: Warning
- Maintenance mode triggered: Critical

### Rollback Plan

If issues arise post-deployment:

1. **Feature Flag Disable**: Set `TEACH_BACK_ENABLED=false`
2. **Database Rollback**: Revert migration if needed
3. **Code Rollback**: Revert to previous version
4. **Data Preservation**: Teach-back data remains in database
5. **User Communication**: Notify users of temporary unavailability

The isolated module design ensures rollback doesn't affect core application functionality.
