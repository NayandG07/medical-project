"""
Data models for teach-back sessions.

Defines Pydantic models for all teach-back entities including sessions,
transcripts, errors, examinations, and summaries.
"""

from enum import Enum
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID


class InputMode(str, Enum):
    """User input mode selection."""
    TEXT = "text"
    VOICE = "voice"
    MIXED = "mixed"


class OutputMode(str, Enum):
    """System output mode selection."""
    TEXT = "text"
    VOICE_TEXT = "voice_text"


class SessionState(str, Enum):
    """Session state machine states."""
    TEACHING = "teaching"
    INTERRUPTED = "interrupted"
    EXAMINING = "examining"
    COMPLETED = "completed"


class ErrorSeverity(str, Enum):
    """Severity levels for detected errors."""
    MINOR = "minor"
    MODERATE = "moderate"
    CRITICAL = "critical"


class Session(BaseModel):
    """Teach-back session model."""
    id: UUID
    user_id: UUID
    topic: Optional[str] = None
    input_mode: InputMode
    output_mode: OutputMode
    state: SessionState
    started_at: datetime
    ended_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        use_enum_values = True


class TranscriptEntry(BaseModel):
    """Single entry in session transcript."""
    id: UUID
    session_id: UUID
    speaker: str  # 'user' or 'system'
    content: str
    is_voice: bool = False
    timestamp: datetime = Field(default_factory=datetime.now)


class DetectedError(BaseModel):
    """Error detected during teaching phase."""
    id: UUID
    session_id: UUID
    error_text: str
    correction: str
    context: Optional[str] = None
    severity: ErrorSeverity
    detected_at: datetime = Field(default_factory=datetime.now)


class ExaminationQA(BaseModel):
    """Question and answer from examination phase."""
    id: UUID
    session_id: UUID
    question: str
    user_answer: Optional[str] = None
    evaluation: Optional[str] = None
    score: Optional[int] = Field(None, ge=0, le=10)  # 0-10 scale
    asked_at: datetime = Field(default_factory=datetime.now)


class SessionSummary(BaseModel):
    """Comprehensive session summary."""
    id: UUID
    session_id: UUID
    user_id: UUID
    total_errors: int
    missed_concepts: List[str] = []
    strong_areas: List[str] = []
    recommendations: List[str] = []
    overall_score: Optional[int] = Field(None, ge=0, le=100)  # 0-100 scale
    created_at: datetime = Field(default_factory=datetime.now)


class RateLimitResult(BaseModel):
    """Result of rate limit check."""
    allowed: bool
    remaining_text_sessions: int
    remaining_voice_sessions: int
    message: Optional[str] = None


class QuotaInfo(BaseModel):
    """User quota information."""
    text_sessions_used: int
    voice_sessions_used: int
    text_sessions_limit: int
    voice_sessions_limit: int
    date: datetime


class TranscriptionResult(BaseModel):
    """Result of STT transcription."""
    success: bool
    text: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class AudioResult(BaseModel):
    """Result of TTS synthesis."""
    success: bool
    audio_data: Optional[bytes] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class OrchestratedResponse(BaseModel):
    """Response from LLM orchestrator."""
    content: str
    role_used: str
    detected_errors: List[DetectedError] = []
    should_interrupt: bool = False
    state_transition: Optional[SessionState] = None
