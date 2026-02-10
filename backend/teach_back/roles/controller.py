"""
Controller role for teach-back sessions.

Manages session flow and state transition decisions.
"""

import logging
from typing import List
from ..models import DetectedError, SessionState, ErrorSeverity

logger = logging.getLogger(__name__)


class Controller:
    """
    Manages session flow and state transitions.
    
    Behavior:
    - Decides when to interrupt for errors
    - Determines when teaching phase should end
    - Triggers examination phase
    - Manages pacing of interaction
    """
    
    def __init__(self):
        """Initialize controller."""
        self.role_name = "Controller"
        self.error_threshold = 3  # Interrupt after 3 minor errors
    
    def should_interrupt(self, errors: List[DetectedError]) -> bool:
        """
        Decide if session should be interrupted for corrections.
        
        Args:
            errors: List of detected errors
            
        Returns:
            True if should interrupt
        """
        if not errors:
            return False
        
        # Interrupt immediately for critical errors
        critical_errors = [e for e in errors if e.severity == ErrorSeverity.CRITICAL]
        if critical_errors:
            logger.info(f"Interrupting for {len(critical_errors)} critical error(s)")
            return True
        
        # Interrupt for moderate errors (1 or more)
        moderate_errors = [e for e in errors if e.severity == ErrorSeverity.MODERATE]
        if moderate_errors:
            logger.info(f"Interrupting for {len(moderate_errors)} moderate error(s)")
            return True
        
        # Accumulate minor errors, interrupt after threshold
        minor_errors = [e for e in errors if e.severity == ErrorSeverity.MINOR]
        if len(minor_errors) >= self.error_threshold:
            logger.info(f"Interrupting for {len(minor_errors)} minor errors (threshold: {self.error_threshold})")
            return True
        
        return False
    
    def should_transition_to_examining(
        self,
        user_input: str,
        conversation_length: int
    ) -> bool:
        """
        Decide if teaching phase should end and examination begin.
        
        Args:
            user_input: Latest user input
            conversation_length: Number of exchanges so far
            
        Returns:
            True if should transition to examining
        """
        # Check for explicit end signals
        end_signals = [
            "that's all",
            "i'm done",
            "finished teaching",
            "end session",
            "ready for questions",
            "test me",
            "quiz me"
        ]
        
        user_input_lower = user_input.lower()
        for signal in end_signals:
            if signal in user_input_lower:
                logger.info(f"User signaled end of teaching: '{signal}'")
                return True
        
        # Don't auto-transition too early
        if conversation_length < 5:
            return False
        
        return False
    
    def get_next_state(
        self,
        current_state: SessionState,
        errors: List[DetectedError],
        user_action: str = None
    ) -> SessionState:
        """
        Determine next state based on current state and context.
        
        Args:
            current_state: Current session state
            errors: Detected errors
            user_action: User action (e.g., "acknowledge", "end_teaching")
            
        Returns:
            Next SessionState
        """
        if current_state == SessionState.TEACHING:
            # Check if should interrupt
            if self.should_interrupt(errors):
                return SessionState.INTERRUPTED
            
            # Check if user wants to end teaching
            if user_action == "end_teaching":
                return SessionState.EXAMINING
            
            return SessionState.TEACHING
        
        elif current_state == SessionState.INTERRUPTED:
            # Return to teaching after acknowledgment
            if user_action == "acknowledge":
                return SessionState.TEACHING
            
            return SessionState.INTERRUPTED
        
        elif current_state == SessionState.EXAMINING:
            # Transition to completed when examination ends
            if user_action == "end_examination":
                return SessionState.COMPLETED
            
            return SessionState.EXAMINING
        
        elif current_state == SessionState.COMPLETED:
            # Terminal state
            return SessionState.COMPLETED
        
        return current_state
    
    def calculate_pacing_delay(
        self,
        conversation_length: int,
        errors_count: int
    ) -> float:
        """
        Calculate appropriate delay for pacing.
        
        Args:
            conversation_length: Number of exchanges
            errors_count: Number of errors detected
            
        Returns:
            Delay in seconds
        """
        # Base delay
        delay = 1.0
        
        # Increase delay if many errors (give user time to process)
        if errors_count > 5:
            delay += 2.0
        elif errors_count > 2:
            delay += 1.0
        
        # Decrease delay as conversation progresses (user is engaged)
        if conversation_length > 20:
            delay = max(0.5, delay - 0.5)
        
        return delay
