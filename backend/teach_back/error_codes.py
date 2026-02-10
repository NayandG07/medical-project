"""
Error codes and failure handling for teach-back feature.

Defines all error codes and provides utilities for error handling.
"""

from enum import Enum
from typing import Dict, Any, Optional


class ErrorCode(str, Enum):
    """Error codes for teach-back feature."""
    
    # Voice processing errors
    STT_UNAVAILABLE = "stt_unavailable"
    STT_FAILED = "stt_failed"
    TTS_UNAVAILABLE = "tts_unavailable"
    TTS_FAILED = "tts_failed"
    AUDIO_QUALITY_POOR = "audio_quality_poor"
    
    # LLM provider errors
    PRIMARY_LLM_FAILED = "primary_llm_failed"
    FALLBACK_LLM_FAILED = "fallback_llm_failed"
    ALL_LLMS_FAILED = "all_llms_failed"
    LLM_RATE_LIMIT = "llm_rate_limit"
    
    # Rate limiting errors
    QUOTA_EXCEEDED = "quota_exceeded"
    VOICE_QUOTA_EXCEEDED = "voice_quota_exceeded"
    SESSION_DURATION_EXCEEDED = "session_duration_exceeded"
    
    # State machine errors
    INVALID_STATE_TRANSITION = "invalid_state_transition"
    STATE_CORRUPTION = "state_corruption"
    INVALID_STATE = "invalid_state"
    
    # Data persistence errors
    DATABASE_ERROR = "database_error"
    STORAGE_QUOTA_EXCEEDED = "storage_quota_exceeded"
    SESSION_NOT_FOUND = "session_not_found"
    SESSION_COMPLETED = "session_completed"
    
    # Integration errors
    INTEGRATION_FAILED = "integration_failed"
    
    # General errors
    MAINTENANCE_MODE = "maintenance_mode"
    NO_INPUT = "no_input"
    PROCESSING_FAILED = "processing_failed"
    SESSION_CREATION_FAILED = "session_creation_failed"
    SESSION_END_FAILED = "session_end_failed"
    EXAMINATION_START_FAILED = "examination_start_failed"
    ANSWER_SUBMISSION_FAILED = "answer_submission_failed"
    ACKNOWLEDGMENT_FAILED = "acknowledgment_failed"


class FailureHandler:
    """Handles failures with proper logging and user notifications."""
    
    @staticmethod
    def create_error_response(
        code: ErrorCode,
        message: str,
        details: Optional[Any] = None,
        recoverable: bool = True,
        fallback_active: bool = False
    ) -> Dict[str, Any]:
        """
        Create standardized error response.
        
        Args:
            code: Error code
            message: Human-readable error message
            details: Optional additional context
            recoverable: Whether user can retry
            fallback_active: Whether fallback mode is active
            
        Returns:
            Standardized error response dictionary
        """
        return {
            "success": False,
            "error": {
                "code": code.value,
                "message": message,
                "details": details,
                "recoverable": recoverable,
                "fallback_active": fallback_active
            }
        }
    
    @staticmethod
    def get_user_friendly_message(code: ErrorCode) -> str:
        """
        Get user-friendly message for error code.
        
        Args:
            code: Error code
            
        Returns:
            User-friendly error message
        """
        messages = {
            ErrorCode.STT_UNAVAILABLE: "Voice input is not available. Please use text mode.",
            ErrorCode.STT_FAILED: "Failed to transcribe audio. Please try again or use text mode.",
            ErrorCode.TTS_UNAVAILABLE: "Voice output is not available. Displaying text only.",
            ErrorCode.TTS_FAILED: "Failed to generate voice output. Displaying text only.",
            ErrorCode.AUDIO_QUALITY_POOR: "Audio quality is too low. Please speak clearly and try again.",
            ErrorCode.PRIMARY_LLM_FAILED: "Primary AI service is unavailable. Trying backup service...",
            ErrorCode.FALLBACK_LLM_FAILED: "Backup AI service is unavailable. Please try again later.",
            ErrorCode.ALL_LLMS_FAILED: "AI services are currently unavailable. System is in maintenance mode.",
            ErrorCode.LLM_RATE_LIMIT: "AI service rate limit reached. Please try again in a few minutes.",
            ErrorCode.QUOTA_EXCEEDED: "You've reached your daily session limit. Please upgrade your plan or try again tomorrow.",
            ErrorCode.VOICE_QUOTA_EXCEEDED: "You've reached your daily voice session limit. Try text mode or upgrade your plan.",
            ErrorCode.SESSION_DURATION_EXCEEDED: "Session duration limit reached. Please end this session and start a new one.",
            ErrorCode.INVALID_STATE_TRANSITION: "Invalid action for current session state.",
            ErrorCode.STATE_CORRUPTION: "Session state error. Please start a new session.",
            ErrorCode.INVALID_STATE: "Cannot perform this action in the current session state.",
            ErrorCode.DATABASE_ERROR: "Database error occurred. Please try again.",
            ErrorCode.STORAGE_QUOTA_EXCEEDED: "Storage quota exceeded. Please contact support.",
            ErrorCode.SESSION_NOT_FOUND: "Session not found. It may have expired.",
            ErrorCode.SESSION_COMPLETED: "This session has already been completed.",
            ErrorCode.INTEGRATION_FAILED: "Failed to sync with learning systems. Your session data is saved.",
            ErrorCode.MAINTENANCE_MODE: "System is in maintenance mode. Please try again later.",
            ErrorCode.NO_INPUT: "No input provided. Please provide text or audio input.",
            ErrorCode.PROCESSING_FAILED: "Failed to process your input. Please try again.",
            ErrorCode.SESSION_CREATION_FAILED: "Failed to create session. Please try again.",
            ErrorCode.SESSION_END_FAILED: "Failed to end session. Please try again.",
            ErrorCode.EXAMINATION_START_FAILED: "Failed to start examination. Please try again.",
            ErrorCode.ANSWER_SUBMISSION_FAILED: "Failed to submit answer. Please try again.",
            ErrorCode.ACKNOWLEDGMENT_FAILED: "Failed to acknowledge interruption. Please try again."
        }
        
        return messages.get(code, "An error occurred. Please try again.")
    
    @staticmethod
    def is_recoverable(code: ErrorCode) -> bool:
        """
        Check if error is recoverable.
        
        Args:
            code: Error code
            
        Returns:
            True if user can retry
        """
        non_recoverable = {
            ErrorCode.ALL_LLMS_FAILED,
            ErrorCode.MAINTENANCE_MODE,
            ErrorCode.QUOTA_EXCEEDED,
            ErrorCode.VOICE_QUOTA_EXCEEDED,
            ErrorCode.SESSION_DURATION_EXCEEDED,
            ErrorCode.STORAGE_QUOTA_EXCEEDED,
            ErrorCode.STATE_CORRUPTION
        }
        
        return code not in non_recoverable
    
    @staticmethod
    def should_trigger_maintenance_mode(code: ErrorCode) -> bool:
        """
        Check if error should trigger maintenance mode.
        
        Args:
            code: Error code
            
        Returns:
            True if should enter maintenance mode
        """
        return code == ErrorCode.ALL_LLMS_FAILED


# Maintenance mode state
_maintenance_mode = False


def is_maintenance_mode() -> bool:
    """Check if system is in maintenance mode."""
    return _maintenance_mode


def enter_maintenance_mode() -> None:
    """Enter maintenance mode."""
    global _maintenance_mode
    _maintenance_mode = True
    import logging
    logging.critical("ENTERING MAINTENANCE MODE: All LLM providers failed")


def exit_maintenance_mode() -> None:
    """Exit maintenance mode."""
    global _maintenance_mode
    _maintenance_mode = False
    import logging
    logging.info("EXITING MAINTENANCE MODE: Services recovered")
