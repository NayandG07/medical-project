"""
Session manager for teach-back sessions.

Manages complete lifecycle of teach-back sessions including creation,
input processing, state transitions, and completion.
"""

import logging
from typing import Optional, Dict, Any
from uuid import uuid4
from datetime import datetime

from .models import (
    Session, SessionState, InputMode, OutputMode,
    SessionSummary, DetectedError
)
from .data_storage import DataStorage
from .state_machine import StateMachine
from .rate_limiter import TeachBackRateLimiter
from .voice_processor import VoiceProcessor
from .llm_orchestrator import LLMOrchestrator

logger = logging.getLogger(__name__)


class SessionManager:
    """
    Manages complete lifecycle of teach-back sessions.
    
    Responsibilities:
    - Create and configure sessions
    - Process user input (text or voice)
    - Coordinate with state machine for transitions
    - Coordinate with LLM orchestrator for responses
    - Coordinate with voice processor for audio
    - Store all interactions in transcript
    - Generate session summaries
    """
    
    def __init__(
        self,
        data_storage: Optional[DataStorage] = None,
        state_machine: Optional[StateMachine] = None,
        rate_limiter: Optional[TeachBackRateLimiter] = None,
        voice_processor: Optional[VoiceProcessor] = None,
        llm_orchestrator: Optional[LLMOrchestrator] = None
    ):
        """
        Initialize session manager.
        
        Args:
            data_storage: DataStorage instance
            state_machine: StateMachine instance
            rate_limiter: TeachBackRateLimiter instance
            voice_processor: VoiceProcessor instance
            llm_orchestrator: LLMOrchestrator instance
        """
        self.data_storage = data_storage or DataStorage()
        self.state_machine = state_machine or StateMachine()
        self.rate_limiter = rate_limiter or TeachBackRateLimiter()
        self.voice_processor = voice_processor or VoiceProcessor()
        self.llm_orchestrator = llm_orchestrator or LLMOrchestrator()
        
        logger.info("SessionManager initialized")
    
    async def create_session(
        self,
        user_id: str,
        user_plan: str,
        input_mode: InputMode,
        output_mode: OutputMode,
        topic: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new teach-back session.
        
        Args:
            user_id: UUID of the user
            user_plan: User's subscription plan
            input_mode: Selected input mode
            output_mode: Selected output mode
            topic: Optional topic being taught
            
        Returns:
            Dictionary with session data or error
        """
        try:
            # Determine if this is a voice session
            is_voice = (
                input_mode in [InputMode.VOICE, InputMode.MIXED] or
                output_mode == OutputMode.VOICE_TEXT
            )
            
            # Check rate limits
            rate_check = await self.rate_limiter.check_session_limit(
                user_id,
                user_plan,
                is_voice
            )
            
            if not rate_check.allowed:
                return {
                    "success": False,
                    "error": {
                        "code": "QUOTA_EXCEEDED",
                        "message": rate_check.message,
                        "remaining_text_sessions": rate_check.remaining_text_sessions,
                        "remaining_voice_sessions": rate_check.remaining_voice_sessions
                    }
                }
            
            # Check voice engine availability if needed
            if input_mode in [InputMode.VOICE, InputMode.MIXED]:
                if not self.voice_processor.is_stt_available():
                    return {
                        "success": False,
                        "error": {
                            "code": "STT_UNAVAILABLE",
                            "message": "Voice input is not available. Please use text mode.",
                            "fallback_mode": "text"
                        }
                    }
            
            if output_mode == OutputMode.VOICE_TEXT:
                if not self.voice_processor.is_tts_available():
                    logger.warning("TTS unavailable, will fallback to text-only output")
                    # Don't block session creation, just log warning
            
            # Create session
            session = Session(
                id=uuid4(),
                user_id=uuid4() if isinstance(user_id, str) else user_id,
                topic=topic,
                input_mode=input_mode,
                output_mode=output_mode,
                state=SessionState.TEACHING,
                started_at=datetime.now()
            )
            
            # Save to database
            session_id = await self.data_storage.save_session(session)
            
            # Increment usage counter
            await self.rate_limiter.increment_session_count(user_id, is_voice)
            
            # Initialize state machine
            self.state_machine.transition(
                session_id,
                SessionState.TEACHING,
                SessionState.TEACHING,
                "Session created"
            )
            
            logger.info(f"Created session {session_id} for user {user_id}")
            
            return {
                "success": True,
                "session": {
                    "id": str(session.id),
                    "input_mode": session.input_mode.value,
                    "output_mode": session.output_mode.value,
                    "state": session.state.value,
                    "topic": session.topic,
                    "started_at": session.started_at.isoformat()
                },
                "remaining_quota": {
                    "text_sessions": rate_check.remaining_text_sessions,
                    "voice_sessions": rate_check.remaining_voice_sessions
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating session: {str(e)}")
            return {
                "success": False,
                "error": {
                    "code": "SESSION_CREATION_FAILED",
                    "message": f"Failed to create session: {str(e)}"
                }
            }
    
    async def get_session(self, session_id: str) -> Optional[Session]:
        """
        Retrieve a session by ID.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            Session object or None
        """
        try:
            return await self.data_storage.get_session(session_id)
        except Exception as e:
            logger.error(f"Error retrieving session: {str(e)}")
            return None
    
    async def process_input(
        self,
        session_id: str,
        content: str = None,
        audio_data: bytes = None
    ) -> Dict[str, Any]:
        """
        Process user input (text or voice).
        
        Args:
            session_id: UUID of the session
            content: Text content (if text input)
            audio_data: Audio bytes (if voice input)
            
        Returns:
            Dictionary with response and metadata
        """
        try:
            # Get session
            session = await self.get_session(session_id)
            if not session:
                return {
                    "success": False,
                    "error": {
                        "code": "SESSION_NOT_FOUND",
                        "message": "Session not found"
                    }
                }
            
            # Check if session is in valid state for input
            if session.state == SessionState.COMPLETED:
                return {
                    "success": False,
                    "error": {
                        "code": "SESSION_COMPLETED",
                        "message": "Session has already been completed"
                    }
                }
            
            # Process voice input if provided
            if audio_data:
                transcription = await self.voice_processor.transcribe_audio(audio_data)
                if not transcription.success:
                    return {
                        "success": False,
                        "error": {
                            "code": transcription.error_code,
                            "message": transcription.error_message,
                            "fallback_mode": "text"
                        }
                    }
                content = transcription.text
            
            if not content:
                return {
                    "success": False,
                    "error": {
                        "code": "NO_INPUT",
                        "message": "No input provided"
                    }
                }
            
            # Save user input to transcript
            await self.data_storage.save_transcript_entry(
                session_id,
                "user",
                content,
                is_voice=bool(audio_data)
            )
            
            # Get conversation history
            transcript = await self.data_storage.get_session_transcript(session_id)
            conversation_history = [
                {"speaker": entry.speaker, "content": entry.content}
                for entry in transcript
            ]
            
            # Generate response using LLM orchestrator
            orchestrated_response = await self.llm_orchestrator.generate_response(
                session,
                content,
                conversation_history
            )
            
            # Handle interruptions
            if orchestrated_response.should_interrupt and orchestrated_response.detected_errors:
                # Save errors
                for error in orchestrated_response.detected_errors:
                    await self.data_storage.save_error(session_id, error)
                
                # Generate interruption message
                evaluator = self.llm_orchestrator.roles["evaluator"]
                interruption_text = evaluator.generate_interruption_response(
                    orchestrated_response.detected_errors
                )
                
                # Transition to interrupted state
                success, error_msg = self.state_machine.transition(
                    session_id,
                    session.state,
                    SessionState.INTERRUPTED,
                    f"Detected {len(orchestrated_response.detected_errors)} error(s)"
                )
                
                if success:
                    session.state = SessionState.INTERRUPTED
                    await self.data_storage.save_session(session)
                
                response_content = interruption_text
            else:
                response_content = orchestrated_response.content
            
            # Save system response to transcript
            await self.data_storage.save_transcript_entry(
                session_id,
                "system",
                response_content,
                is_voice=False
            )
            
            # Generate voice output if needed
            audio_response = None
            if session.output_mode == OutputMode.VOICE_TEXT:
                audio_result = await self.voice_processor.synthesize_speech(response_content)
                if audio_result.success:
                    audio_response = audio_result.audio_data
                else:
                    logger.warning(f"TTS failed: {audio_result.error_message}")
            
            return {
                "success": True,
                "response": {
                    "content": response_content,
                    "audio": audio_response,
                    "state": session.state.value,
                    "interrupted": orchestrated_response.should_interrupt,
                    "errors_detected": len(orchestrated_response.detected_errors)
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing input: {str(e)}")
            return {
                "success": False,
                "error": {
                    "code": "PROCESSING_FAILED",
                    "message": f"Failed to process input: {str(e)}"
                }
            }
    
    async def start_examination(self, session_id: str) -> Dict[str, Any]:
        """
        Transition to examination phase and generate first question.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            Dictionary with first examination question
        """
        try:
            # Get session
            session = await self.get_session(session_id)
            if not session:
                return {
                    "success": False,
                    "error": {
                        "code": "SESSION_NOT_FOUND",
                        "message": "Session not found"
                    }
                }
            
            # Check if in teaching state
            if session.state != SessionState.TEACHING:
                return {
                    "success": False,
                    "error": {
                        "code": "INVALID_STATE",
                        "message": "Can only start examination from teaching state"
                    }
                }
            
            # Transition to examining
            success, error_msg = self.state_machine.transition(
                session_id,
                SessionState.TEACHING,
                SessionState.EXAMINING,
                "User ended teaching phase"
            )
            
            if not success:
                return {
                    "success": False,
                    "error": {
                        "code": "INVALID_STATE_TRANSITION",
                        "message": error_msg
                    }
                }
            
            # Update session
            session.state = SessionState.EXAMINING
            await self.data_storage.save_session(session)
            
            # Get errors and generate first question
            errors = await self.data_storage.get_session_errors(session_id)
            
            # TODO: Implement proper strong areas detection
            strong_areas = []
            
            # Generate examination question
            question = await self.llm_orchestrator.generate_examination_question(
                session,
                errors,
                strong_areas
            )
            
            # Save question
            await self.data_storage.save_examination_qa(
                session_id,
                question=question
            )
            
            logger.info(f"Session {session_id} transitioned to examination phase")
            
            return {
                "success": True,
                "question": question,
                "state": session.state.value
            }
            
        except Exception as e:
            logger.error(f"Error starting examination: {str(e)}")
            return {
                "success": False,
                "error": {
                    "code": "EXAMINATION_START_FAILED",
                    "message": f"Failed to start examination: {str(e)}"
                }
            }
    
    async def submit_examination_answer(
        self,
        session_id: str,
        question: str,
        answer: str
    ) -> Dict[str, Any]:
        """
        Submit answer to examination question and get evaluation.
        
        Args:
            session_id: UUID of the session
            question: Question that was asked
            answer: User's answer
            
        Returns:
            Dictionary with evaluation and next question (if any)
        """
        try:
            # Get session
            session = await self.get_session(session_id)
            if not session:
                return {
                    "success": False,
                    "error": {
                        "code": "SESSION_NOT_FOUND",
                        "message": "Session not found"
                    }
                }
            
            # Check if in examining state
            if session.state != SessionState.EXAMINING:
                return {
                    "success": False,
                    "error": {
                        "code": "INVALID_STATE",
                        "message": "Session is not in examination phase"
                    }
                }
            
            # Evaluate answer
            evaluation_result = await self.llm_orchestrator.evaluate_answer(
                question,
                answer
            )
            
            # Save Q&A with evaluation
            await self.data_storage.save_examination_qa(
                session_id,
                question=question,
                answer=answer,
                evaluation=evaluation_result["evaluation"],
                score=evaluation_result["score"]
            )
            
            logger.info(f"Examination answer evaluated with score {evaluation_result['score']}/10")
            
            return {
                "success": True,
                "evaluation": evaluation_result["evaluation"],
                "score": evaluation_result["score"],
                "state": session.state.value
            }
            
        except Exception as e:
            logger.error(f"Error submitting examination answer: {str(e)}")
            return {
                "success": False,
                "error": {
                    "code": "ANSWER_SUBMISSION_FAILED",
                    "message": f"Failed to submit answer: {str(e)}"
                }
            }
    
    async def acknowledge_interruption(self, session_id: str) -> Dict[str, Any]:
        """
        Acknowledge interruption and return to teaching state.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            Dictionary with success status
        """
        try:
            # Get session
            session = await self.get_session(session_id)
            if not session:
                return {
                    "success": False,
                    "error": {
                        "code": "SESSION_NOT_FOUND",
                        "message": "Session not found"
                    }
                }
            
            # Check if in interrupted state
            if session.state != SessionState.INTERRUPTED:
                return {
                    "success": False,
                    "error": {
                        "code": "INVALID_STATE",
                        "message": "Session is not in interrupted state"
                    }
                }
            
            # Transition back to teaching
            success, error_msg = self.state_machine.transition(
                session_id,
                SessionState.INTERRUPTED,
                SessionState.TEACHING,
                "User acknowledged interruption"
            )
            
            if not success:
                return {
                    "success": False,
                    "error": {
                        "code": "INVALID_STATE_TRANSITION",
                        "message": error_msg
                    }
                }
            
            # Update session
            session.state = SessionState.TEACHING
            await self.data_storage.save_session(session)
            
            logger.info(f"Session {session_id} returned to teaching state")
            
            return {
                "success": True,
                "message": "Returned to teaching. Please continue.",
                "state": session.state.value
            }
            
        except Exception as e:
            logger.error(f"Error acknowledging interruption: {str(e)}")
            return {
                "success": False,
                "error": {
                    "code": "ACKNOWLEDGMENT_FAILED",
                    "message": f"Failed to acknowledge interruption: {str(e)}"
                }
            }
    
    async def end_session(self, session_id: str) -> Dict[str, Any]:
        """
        End session and generate summary.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            Dictionary with summary
        """
        try:
            # Get session
            session = await self.get_session(session_id)
            if not session:
                return {
                    "success": False,
                    "error": {
                        "code": "SESSION_NOT_FOUND",
                        "message": "Session not found"
                    }
                }
            
            # Transition to completed
            success, error_msg = self.state_machine.transition(
                session_id,
                session.state,
                SessionState.COMPLETED,
                "Session ended by user"
            )
            
            if not success:
                return {
                    "success": False,
                    "error": {
                        "code": "INVALID_STATE_TRANSITION",
                        "message": error_msg
                    }
                }
            
            # Update session
            session.state = SessionState.COMPLETED
            session.ended_at = datetime.now()
            await self.data_storage.save_session(session)
            
            # Generate summary
            errors = await self.data_storage.get_session_errors(session_id)
            
            # Extract missed concepts from errors
            missed_concepts = list(set([error.error_text for error in errors]))
            
            # TODO: Implement proper strong areas detection
            strong_areas = []
            
            # TODO: Implement proper recommendations generation
            recommendations = [
                "Review the corrected concepts",
                "Practice explaining these topics again"
            ]
            
            # Calculate overall score
            overall_score = max(0, 100 - (len(errors) * 10))
            
            summary = SessionSummary(
                id=uuid4(),
                session_id=session.id,
                user_id=session.user_id,
                total_errors=len(errors),
                missed_concepts=missed_concepts[:10],  # Limit to 10
                strong_areas=strong_areas,
                recommendations=recommendations,
                overall_score=overall_score
            )
            
            # Save summary
            await self.data_storage.save_summary(session_id, summary)
            
            logger.info(f"Session {session_id} ended and summary generated")
            
            return {
                "success": True,
                "summary": {
                    "total_errors": summary.total_errors,
                    "missed_concepts": summary.missed_concepts,
                    "strong_areas": summary.strong_areas,
                    "recommendations": summary.recommendations,
                    "overall_score": summary.overall_score
                }
            }
            
        except Exception as e:
            logger.error(f"Error ending session: {str(e)}")
            return {
                "success": False,
                "error": {
                    "code": "SESSION_END_FAILED",
                    "message": f"Failed to end session: {str(e)}"
                }
            }
