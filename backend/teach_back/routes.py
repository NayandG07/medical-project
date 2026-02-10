"""
FastAPI routes for teach-back feature.

Provides REST API endpoints for session management.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Optional, List
from pydantic import BaseModel
import logging

from .session_manager import SessionManager
from .models import InputMode, OutputMode
from .rate_limiter import TeachBackRateLimiter
from .integrations import TeachBackIntegrations

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/teach-back", tags=["teach-back"])

# Initialize components
session_manager = SessionManager()
rate_limiter = TeachBackRateLimiter()
integrations = TeachBackIntegrations()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CreateSessionRequest(BaseModel):
    """Request to create a new session."""
    input_mode: str  # 'text', 'voice', 'mixed'
    output_mode: str  # 'text', 'voice_text'
    topic: Optional[str] = None


class ProcessInputRequest(BaseModel):
    """Request to process user input."""
    content: Optional[str] = None  # Text content (if text input)


class SubmitAnswerRequest(BaseModel):
    """Request to submit examination answer."""
    question: str
    answer: str


# ============================================================================
# AUTHENTICATION DEPENDENCY
# ============================================================================

async def get_current_user(
    # TODO: Implement proper authentication
    # For now, return mock user
):
    """Get current authenticated user."""
    return {
        "id": "mock-user-id",
        "plan": "student"
    }


# ============================================================================
# ROUTES
# ============================================================================

@router.post("/sessions")
async def create_session(
    request: CreateSessionRequest,
    user: dict = Depends(get_current_user)
):
    """
    Create a new teach-back session.
    
    Validates mode selection and checks rate limits before creating session.
    """
    try:
        # Parse modes
        input_mode = InputMode(request.input_mode)
        output_mode = OutputMode(request.output_mode)
        
        # Create session
        result = await session_manager.create_session(
            user_id=user["id"],
            user_plan=user["plan"],
            input_mode=input_mode,
            output_mode=output_mode,
            topic=request.topic
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {str(e)}")
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create session")


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Get session details by ID.
    
    Returns session state, configuration, and metadata.
    """
    try:
        session = await session_manager.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify user owns session
        if str(session.user_id) != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "success": True,
            "session": {
                "id": str(session.id),
                "topic": session.topic,
                "input_mode": session.input_mode.value,
                "output_mode": session.output_mode.value,
                "state": session.state.value,
                "started_at": session.started_at.isoformat(),
                "ended_at": session.ended_at.isoformat() if session.ended_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get session")


@router.post("/sessions/{session_id}/input")
async def process_input(
    session_id: str,
    request: ProcessInputRequest = None,
    audio: UploadFile = File(None),
    user: dict = Depends(get_current_user)
):
    """
    Process user input (text or voice).
    
    Accepts either text content or audio file.
    Returns system response with any interruptions.
    """
    try:
        # Verify session ownership
        session = await session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if str(session.user_id) != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Process input
        if audio:
            # Voice input
            audio_data = await audio.read()
            result = await session_manager.process_input(
                session_id=session_id,
                audio_data=audio_data
            )
        elif request and request.content:
            # Text input
            result = await session_manager.process_input(
                session_id=session_id,
                content=request.content
            )
        else:
            raise HTTPException(status_code=400, detail="No input provided")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing input: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process input")


@router.post("/sessions/{session_id}/acknowledge")
async def acknowledge_interruption(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Acknowledge interruption and return to teaching state.
    """
    try:
        # Verify session ownership
        session = await session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if str(session.user_id) != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Acknowledge
        result = await session_manager.acknowledge_interruption(session_id)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging interruption: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to acknowledge interruption")


@router.post("/sessions/{session_id}/start-examination")
async def start_examination(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """
    End teaching phase and start examination.
    
    Returns first examination question.
    """
    try:
        # Verify session ownership
        session = await session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if str(session.user_id) != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Start examination
        result = await session_manager.start_examination(session_id)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting examination: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start examination")


@router.post("/sessions/{session_id}/submit-answer")
async def submit_answer(
    session_id: str,
    request: SubmitAnswerRequest,
    user: dict = Depends(get_current_user)
):
    """
    Submit answer to examination question.
    
    Returns evaluation and score.
    """
    try:
        # Verify session ownership
        session = await session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if str(session.user_id) != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Submit answer
        result = await session_manager.submit_examination_answer(
            session_id=session_id,
            question=request.question,
            answer=request.answer
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting answer: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit answer")


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """
    End session and generate summary.
    
    Triggers integrations with other learning systems.
    """
    try:
        # Verify session ownership
        session = await session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if str(session.user_id) != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # End session
        result = await session_manager.end_session(session_id)
        
        # Trigger integrations (async, don't wait)
        if result["success"]:
            # Fire and forget
            import asyncio
            asyncio.create_task(integrations.feed_all_integrations(session_id))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ending session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to end session")


@router.get("/sessions/{session_id}/transcript")
async def get_transcript(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Get complete session transcript.
    """
    try:
        # Verify session ownership
        session = await session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if str(session.user_id) != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get transcript
        transcript = await session_manager.data_storage.get_session_transcript(session_id)
        
        return {
            "success": True,
            "transcript": [
                {
                    "speaker": entry.speaker,
                    "content": entry.content,
                    "is_voice": entry.is_voice,
                    "timestamp": entry.timestamp.isoformat()
                }
                for entry in transcript
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting transcript: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get transcript")


@router.get("/sessions")
async def list_sessions(
    limit: int = 10,
    offset: int = 0,
    user: dict = Depends(get_current_user)
):
    """
    List user's sessions with pagination.
    """
    try:
        sessions = await session_manager.data_storage.get_user_sessions(
            user_id=user["id"],
            limit=limit,
            offset=offset
        )
        
        return {
            "success": True,
            "sessions": [
                {
                    "id": str(session.id),
                    "topic": session.topic,
                    "state": session.state.value,
                    "started_at": session.started_at.isoformat(),
                    "ended_at": session.ended_at.isoformat() if session.ended_at else None
                }
                for session in sessions
            ],
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list sessions")


@router.get("/quota")
async def get_quota(
    user: dict = Depends(get_current_user)
):
    """
    Get remaining quota for current user.
    """
    try:
        quota_info = await rate_limiter.get_remaining_quota(
            user_id=user["id"],
            user_plan=user["plan"]
        )
        
        return {
            "success": True,
            "quota": {
                "text_sessions_used": quota_info.text_sessions_used,
                "voice_sessions_used": quota_info.voice_sessions_used,
                "text_sessions_limit": quota_info.text_sessions_limit,
                "voice_sessions_limit": quota_info.voice_sessions_limit,
                "date": quota_info.date.isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting quota: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get quota")
