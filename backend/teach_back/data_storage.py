"""
Data storage layer for teach-back sessions.

Handles all database operations for sessions, transcripts, errors,
examinations, and summaries with proper error handling and transactions.
"""

import os
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, date
from supabase import Client, create_client
from dotenv import load_dotenv

from .models import (
    Session, TranscriptEntry, DetectedError, ExaminationQA, SessionSummary,
    InputMode, OutputMode, SessionState, ErrorSeverity
)

load_dotenv()


class DataStorage:
    """Handles all database operations for teach-back feature."""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize data storage with Supabase client.
        
        Args:
            supabase_client: Optional Supabase client for dependency injection
        """
        if supabase_client:
            self.supabase = supabase_client
        else:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
            self.supabase = create_client(supabase_url, supabase_key)
    
    async def save_session(self, session: Session) -> str:
        """
        Save a new session or update existing session.
        
        Args:
            session: Session object to save
            
        Returns:
            Session ID as string
            
        Raises:
            Exception: If database operation fails
        """
        try:
            session_data = {
                "id": str(session.id),
                "user_id": str(session.user_id),
                "topic": session.topic,
                "input_mode": session.input_mode.value,
                "output_mode": session.output_mode.value,
                "state": session.state.value,
                "started_at": session.started_at.isoformat(),
                "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                "created_at": session.created_at.isoformat(),
                "updated_at": session.updated_at.isoformat()
            }
            
            result = self.supabase.table("teach_back_sessions").upsert(session_data).execute()
            
            if not result.data:
                raise Exception("Failed to save session")
            
            return str(session.id)
        except Exception as e:
            raise Exception(f"Error saving session: {str(e)}")
    
    async def get_session(self, session_id: str) -> Optional[Session]:
        """
        Retrieve a session by ID.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            Session object or None if not found
        """
        try:
            result = self.supabase.table("teach_back_sessions")\
                .select("*")\
                .eq("id", session_id)\
                .execute()
            
            if not result.data:
                return None
            
            data = result.data[0]
            return Session(
                id=UUID(data["id"]),
                user_id=UUID(data["user_id"]),
                topic=data.get("topic"),
                input_mode=InputMode(data["input_mode"]),
                output_mode=OutputMode(data["output_mode"]),
                state=SessionState(data["state"]),
                started_at=datetime.fromisoformat(data["started_at"]),
                ended_at=datetime.fromisoformat(data["ended_at"]) if data.get("ended_at") else None,
                created_at=datetime.fromisoformat(data["created_at"]),
                updated_at=datetime.fromisoformat(data["updated_at"])
            )
        except Exception as e:
            raise Exception(f"Error retrieving session: {str(e)}")
    
    async def save_transcript_entry(
        self,
        session_id: str,
        speaker: str,
        content: str,
        is_voice: bool = False
    ) -> None:
        """
        Save a transcript entry.
        
        Args:
            session_id: UUID of the session
            speaker: 'user' or 'system'
            content: Text content of the entry
            is_voice: Whether this was voice input/output
        """
        try:
            entry_data = {
                "session_id": session_id,
                "speaker": speaker,
                "content": content,
                "is_voice": is_voice,
                "timestamp": datetime.now().isoformat()
            }
            
            result = self.supabase.table("teach_back_transcripts").insert(entry_data).execute()
            
            if not result.data:
                raise Exception("Failed to save transcript entry")
        except Exception as e:
            raise Exception(f"Error saving transcript entry: {str(e)}")
    
    async def save_error(self, session_id: str, error: DetectedError) -> None:
        """
        Save a detected error.
        
        Args:
            session_id: UUID of the session
            error: DetectedError object
        """
        try:
            error_data = {
                "session_id": session_id,
                "error_text": error.error_text,
                "correction": error.correction,
                "context": error.context,
                "severity": error.severity.value,
                "detected_at": error.detected_at.isoformat()
            }
            
            result = self.supabase.table("teach_back_errors").insert(error_data).execute()
            
            if not result.data:
                raise Exception("Failed to save error")
        except Exception as e:
            raise Exception(f"Error saving detected error: {str(e)}")
    
    async def save_examination_qa(
        self,
        session_id: str,
        question: str,
        answer: Optional[str] = None,
        evaluation: Optional[str] = None,
        score: Optional[int] = None
    ) -> None:
        """
        Save an examination question and answer.
        
        Args:
            session_id: UUID of the session
            question: Question text
            answer: User's answer (optional)
            evaluation: Evaluation of the answer (optional)
            score: Score 0-10 (optional)
        """
        try:
            qa_data = {
                "session_id": session_id,
                "question": question,
                "user_answer": answer,
                "evaluation": evaluation,
                "score": score,
                "asked_at": datetime.now().isoformat()
            }
            
            result = self.supabase.table("teach_back_examinations").insert(qa_data).execute()
            
            if not result.data:
                raise Exception("Failed to save examination Q&A")
        except Exception as e:
            raise Exception(f"Error saving examination Q&A: {str(e)}")
    
    async def save_summary(self, session_id: str, summary: SessionSummary) -> None:
        """
        Save a session summary.
        
        Args:
            session_id: UUID of the session
            summary: SessionSummary object
        """
        try:
            summary_data = {
                "session_id": session_id,
                "total_errors": summary.total_errors,
                "missed_concepts": summary.missed_concepts,
                "strong_areas": summary.strong_areas,
                "recommendations": summary.recommendations,
                "overall_score": summary.overall_score,
                "created_at": summary.created_at.isoformat()
            }
            
            result = self.supabase.table("teach_back_summaries").insert(summary_data).execute()
            
            if not result.data:
                raise Exception("Failed to save summary")
        except Exception as e:
            raise Exception(f"Error saving summary: {str(e)}")
    
    async def get_session_transcript(self, session_id: str) -> List[TranscriptEntry]:
        """
        Retrieve complete transcript for a session.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            List of TranscriptEntry objects ordered by timestamp
        """
        try:
            result = self.supabase.table("teach_back_transcripts")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("timestamp")\
                .execute()
            
            if not result.data:
                return []
            
            return [
                TranscriptEntry(
                    id=UUID(entry["id"]),
                    session_id=UUID(entry["session_id"]),
                    speaker=entry["speaker"],
                    content=entry["content"],
                    is_voice=entry.get("is_voice", False),
                    timestamp=datetime.fromisoformat(entry["timestamp"])
                )
                for entry in result.data
            ]
        except Exception as e:
            raise Exception(f"Error retrieving transcript: {str(e)}")
    
    async def get_session_errors(self, session_id: str) -> List[DetectedError]:
        """
        Retrieve all errors for a session.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            List of DetectedError objects
        """
        try:
            result = self.supabase.table("teach_back_errors")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("detected_at")\
                .execute()
            
            if not result.data:
                return []
            
            return [
                DetectedError(
                    id=UUID(error["id"]),
                    session_id=UUID(error["session_id"]),
                    error_text=error["error_text"],
                    correction=error["correction"],
                    context=error.get("context"),
                    severity=ErrorSeverity(error["severity"]),
                    detected_at=datetime.fromisoformat(error["detected_at"])
                )
                for error in result.data
            ]
        except Exception as e:
            raise Exception(f"Error retrieving errors: {str(e)}")
    
    async def get_user_sessions(
        self,
        user_id: str,
        limit: int = 10,
        offset: int = 0
    ) -> List[Session]:
        """
        Retrieve sessions for a user.
        
        Args:
            user_id: UUID of the user
            limit: Maximum number of sessions to return
            offset: Number of sessions to skip
            
        Returns:
            List of Session objects ordered by created_at descending
        """
        try:
            result = self.supabase.table("teach_back_sessions")\
                .select("*")\
                .eq("user_id", user_id)\
                .order("created_at", desc=True)\
                .limit(limit)\
                .offset(offset)\
                .execute()
            
            if not result.data:
                return []
            
            return [
                Session(
                    id=UUID(data["id"]),
                    user_id=UUID(data["user_id"]),
                    topic=data.get("topic"),
                    input_mode=InputMode(data["input_mode"]),
                    output_mode=OutputMode(data["output_mode"]),
                    state=SessionState(data["state"]),
                    started_at=datetime.fromisoformat(data["started_at"]),
                    ended_at=datetime.fromisoformat(data["ended_at"]) if data.get("ended_at") else None,
                    created_at=datetime.fromisoformat(data["created_at"]),
                    updated_at=datetime.fromisoformat(data["updated_at"])
                )
                for data in result.data
            ]
        except Exception as e:
            raise Exception(f"Error retrieving user sessions: {str(e)}")
    
    async def get_summary(self, session_id: str) -> Optional[SessionSummary]:
        """
        Retrieve summary for a session.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            SessionSummary object or None if not found
        """
        try:
            result = self.supabase.table("teach_back_summaries")\
                .select("*")\
                .eq("session_id", session_id)\
                .execute()
            
            if not result.data:
                return None
            
            data = result.data[0]
            
            # Get user_id from session
            session = await self.get_session(session_id)
            if not session:
                return None
            
            return SessionSummary(
                id=UUID(data["id"]),
                session_id=UUID(data["session_id"]),
                user_id=session.user_id,
                total_errors=data["total_errors"],
                missed_concepts=data.get("missed_concepts", []),
                strong_areas=data.get("strong_areas", []),
                recommendations=data.get("recommendations", []),
                overall_score=data.get("overall_score"),
                created_at=datetime.fromisoformat(data["created_at"])
            )
        except Exception as e:
            raise Exception(f"Error retrieving summary: {str(e)}")
