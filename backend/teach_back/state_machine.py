"""
State machine for teach-back session flow.

Manages session state transitions with validation and logging.
"""

import logging
from typing import Dict, Set, Optional, Tuple
from datetime import datetime
from .models import SessionState

logger = logging.getLogger(__name__)


class StateMachine:
    """
    Manages session state transitions for teach-back sessions.
    
    Valid state transitions:
    - TEACHING → INTERRUPTED (error detected)
    - INTERRUPTED → TEACHING (user acknowledges)
    - TEACHING → EXAMINING (user ends teaching)
    - EXAMINING → COMPLETED (examination finished)
    """
    
    # Define valid state transitions
    VALID_TRANSITIONS: Dict[SessionState, Set[SessionState]] = {
        SessionState.TEACHING: {
            SessionState.INTERRUPTED,
            SessionState.EXAMINING
        },
        SessionState.INTERRUPTED: {
            SessionState.TEACHING
        },
        SessionState.EXAMINING: {
            SessionState.COMPLETED
        },
        SessionState.COMPLETED: set()  # Terminal state, no transitions
    }
    
    def __init__(self):
        """Initialize the state machine."""
        self._state_history: Dict[str, list] = {}
    
    def can_transition(
        self,
        from_state: SessionState,
        to_state: SessionState
    ) -> bool:
        """
        Check if a state transition is valid.
        
        Args:
            from_state: Current state
            to_state: Desired state
            
        Returns:
            True if transition is valid, False otherwise
        """
        if from_state not in self.VALID_TRANSITIONS:
            return False
        
        return to_state in self.VALID_TRANSITIONS[from_state]
    
    def transition(
        self,
        session_id: str,
        from_state: SessionState,
        to_state: SessionState,
        reason: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Attempt to transition session state.
        
        Args:
            session_id: UUID of the session
            from_state: Current state
            to_state: Desired state
            reason: Reason for transition
            
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        # Validate transition
        if not self.can_transition(from_state, to_state):
            error_msg = f"Invalid state transition: {from_state.value} → {to_state.value}"
            logger.warning(
                f"Session {session_id}: {error_msg}. Reason: {reason}"
            )
            return False, error_msg
        
        # Log transition
        timestamp = datetime.now()
        transition_log = {
            "from_state": from_state.value,
            "to_state": to_state.value,
            "reason": reason,
            "timestamp": timestamp.isoformat()
        }
        
        # Store in history
        if session_id not in self._state_history:
            self._state_history[session_id] = []
        self._state_history[session_id].append(transition_log)
        
        logger.info(
            f"Session {session_id}: State transition {from_state.value} → {to_state.value}. "
            f"Reason: {reason}"
        )
        
        return True, None
    
    def get_current_state(self, session_id: str) -> Optional[SessionState]:
        """
        Get the current state for a session from history.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            Current SessionState or None if no history
        """
        if session_id not in self._state_history or not self._state_history[session_id]:
            return None
        
        last_transition = self._state_history[session_id][-1]
        return SessionState(last_transition["to_state"])
    
    def get_state_history(self, session_id: str) -> list:
        """
        Get complete state transition history for a session.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            List of transition logs
        """
        return self._state_history.get(session_id, [])
    
    def clear_history(self, session_id: str) -> None:
        """
        Clear state history for a session.
        
        Args:
            session_id: UUID of the session
        """
        if session_id in self._state_history:
            del self._state_history[session_id]
    
    @staticmethod
    def get_initial_state() -> SessionState:
        """
        Get the initial state for new sessions.
        
        Returns:
            SessionState.TEACHING
        """
        return SessionState.TEACHING
    
    @staticmethod
    def is_terminal_state(state: SessionState) -> bool:
        """
        Check if a state is terminal (no further transitions).
        
        Args:
            state: State to check
            
        Returns:
            True if terminal state
        """
        return state == SessionState.COMPLETED
    
    @staticmethod
    def get_valid_next_states(current_state: SessionState) -> Set[SessionState]:
        """
        Get all valid next states from current state.
        
        Args:
            current_state: Current state
            
        Returns:
            Set of valid next states
        """
        return StateMachine.VALID_TRANSITIONS.get(current_state, set())
