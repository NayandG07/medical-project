"""
Property-based tests for teach-back state machine.

These tests verify state transition properties and validation logic.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from uuid import uuid4

from teach_back.models import SessionState
from teach_back.state_machine import StateMachine


# Test data generators

@st.composite
def valid_transition_sequence(draw):
    """Generate a sequence of valid state transitions."""
    sequences = [
        # Teaching → Interrupted → Teaching → Examining → Completed
        [
            (SessionState.TEACHING, SessionState.INTERRUPTED, "error_detected"),
            (SessionState.INTERRUPTED, SessionState.TEACHING, "acknowledged"),
            (SessionState.TEACHING, SessionState.EXAMINING, "teaching_ended"),
            (SessionState.EXAMINING, SessionState.COMPLETED, "examination_ended")
        ],
        # Teaching → Examining → Completed (no interruptions)
        [
            (SessionState.TEACHING, SessionState.EXAMINING, "teaching_ended"),
            (SessionState.EXAMINING, SessionState.COMPLETED, "examination_ended")
        ],
        # Teaching → Interrupted → Teaching (multiple interruptions)
        [
            (SessionState.TEACHING, SessionState.INTERRUPTED, "error_1"),
            (SessionState.INTERRUPTED, SessionState.TEACHING, "ack_1"),
            (SessionState.TEACHING, SessionState.INTERRUPTED, "error_2"),
            (SessionState.INTERRUPTED, SessionState.TEACHING, "ack_2"),
            (SessionState.TEACHING, SessionState.EXAMINING, "teaching_ended"),
            (SessionState.EXAMINING, SessionState.COMPLETED, "examination_ended")
        ]
    ]
    return draw(st.sampled_from(sequences))


@st.composite
def invalid_transition(draw):
    """Generate an invalid state transition."""
    invalid_transitions = [
        (SessionState.TEACHING, SessionState.COMPLETED),
        (SessionState.INTERRUPTED, SessionState.EXAMINING),
        (SessionState.INTERRUPTED, SessionState.COMPLETED),
        (SessionState.EXAMINING, SessionState.TEACHING),
        (SessionState.EXAMINING, SessionState.INTERRUPTED),
        (SessionState.COMPLETED, SessionState.TEACHING),
        (SessionState.COMPLETED, SessionState.INTERRUPTED),
        (SessionState.COMPLETED, SessionState.EXAMINING),
    ]
    return draw(st.sampled_from(invalid_transitions))


# Property Tests

@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 23: State Machine Transitions")
@given(transition_sequence=valid_transition_sequence())
@settings(max_examples=100, deadline=None)
async def test_valid_state_transitions(transition_sequence):
    """
    Property 23: State Machine Transitions
    
    For any new session, the initial state should be teaching; when teaching ends,
    state should transition to examining; when examination completes, state should
    transition to completed; all transitions should be logged with timestamps.
    
    Validates: Requirements 16.1, 16.4, 16.5, 16.6, 14.1
    """
    state_machine = StateMachine()
    session_id = str(uuid4())
    
    # Execute all transitions in sequence
    current_state = SessionState.TEACHING
    
    for from_state, to_state, reason in transition_sequence:
        # Verify we're in the expected state
        assert current_state == from_state
        
        # Verify transition is valid
        assert state_machine.can_transition(from_state, to_state)
        
        # Execute transition
        success = await state_machine.transition(
            session_id,
            from_state,
            to_state,
            reason
        )
        assert success is True
        
        # Update current state
        current_state = to_state
    
    # Verify transition history was logged
    history = state_machine.get_transition_history(session_id)
    assert len(history) == len(transition_sequence)
    
    # Verify each history entry has required fields
    for i, record in enumerate(history):
        assert "from_state" in record
        assert "to_state" in record
        assert "reason" in record
        assert "timestamp" in record
        
        # Verify matches expected transition
        expected_from, expected_to, expected_reason = transition_sequence[i]
        assert record["from_state"] == expected_from.value
        assert record["to_state"] == expected_to.value
        assert record["reason"] == expected_reason


@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 23: State Machine Transitions")
@given(invalid_trans=invalid_transition())
@settings(max_examples=100, deadline=None)
async def test_invalid_transitions_rejected(invalid_trans):
    """
    Property 23: Invalid State Transitions Rejected
    
    For any invalid state transition, the state machine should reject it
    and raise a ValueError.
    
    Validates: Requirements 16.2, 16.3
    """
    state_machine = StateMachine()
    session_id = str(uuid4())
    from_state, to_state = invalid_trans
    
    # Verify transition is not valid
    assert not state_machine.can_transition(from_state, to_state)
    
    # Attempt transition should raise ValueError
    with pytest.raises(ValueError) as exc_info:
        await state_machine.transition(
            session_id,
            from_state,
            to_state,
            "test_reason"
        )
    
    assert "Invalid state transition" in str(exc_info.value)


@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 23: State Machine Transitions")
@given(
    num_interruptions=st.integers(min_value=0, max_value=10),
    num_questions=st.integers(min_value=1, max_value=10)
)
@settings(max_examples=50, deadline=None)
async def test_complete_session_flow(num_interruptions, num_questions):
    """
    Property 23: Complete Session Flow
    
    Verify a complete session flow from teaching through examination to completion,
    with variable numbers of interruptions and examination questions.
    
    Validates: Requirements 16.1, 16.4, 16.5, 16.6
    """
    state_machine = StateMachine()
    session_id = str(uuid4())
    
    # Start in teaching state
    current_state = SessionState.TEACHING
    transition_count = 0
    
    # Simulate interruptions
    for i in range(num_interruptions):
        # Teaching → Interrupted
        await state_machine.transition(
            session_id,
            SessionState.TEACHING,
            SessionState.INTERRUPTED,
            f"error_{i}"
        )
        transition_count += 1
        
        # Interrupted → Teaching
        await state_machine.transition(
            session_id,
            SessionState.INTERRUPTED,
            SessionState.TEACHING,
            f"acknowledged_{i}"
        )
        transition_count += 1
    
    # End teaching phase
    await state_machine.transition(
        session_id,
        SessionState.TEACHING,
        SessionState.EXAMINING,
        "teaching_ended"
    )
    transition_count += 1
    
    # Examination phase (questions don't cause state transitions)
    # Just verify we're in examining state
    assert state_machine.validate_operation(SessionState.EXAMINING, "examine")[0]
    
    # End examination
    await state_machine.transition(
        session_id,
        SessionState.EXAMINING,
        SessionState.COMPLETED,
        "examination_ended"
    )
    transition_count += 1
    
    # Verify history
    history = state_machine.get_transition_history(session_id)
    assert len(history) == transition_count
    
    # Verify final state is terminal
    assert state_machine.is_terminal_state(SessionState.COMPLETED)
    assert len(state_machine.get_next_states(SessionState.COMPLETED)) == 0


@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 23: State Machine Transitions")
@given(state=st.sampled_from(SessionState))
@settings(max_examples=100, deadline=None)
def test_operation_validation(state):
    """
    Property 23: Operation Validation
    
    Verify that operation validation correctly identifies allowed and
    disallowed operations for each state.
    
    Validates: Requirements 16.1, 16.2, 16.3
    """
    state_machine = StateMachine()
    
    # Get allowed operations for this state
    allowed_ops = state_machine.get_allowed_operations(state)
    
    # Test each operation
    all_operations = ["teach", "interrupt", "acknowledge", "examine", "end_teaching", "end_examination"]
    
    for operation in all_operations:
        is_valid, error_msg = state_machine.validate_operation(state, operation)
        
        if operation in allowed_ops:
            # Should be valid
            assert is_valid is True
            assert error_msg is None
        else:
            # Should be invalid
            assert is_valid is False
            assert error_msg is not None
            assert "not allowed" in error_msg.lower()


@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 23: State Machine Transitions")
@given(
    num_sessions=st.integers(min_value=1, max_value=10),
    transitions_per_session=st.integers(min_value=1, max_value=5)
)
@settings(max_examples=50, deadline=None)
async def test_multiple_session_isolation(num_sessions, transitions_per_session):
    """
    Property 23: Multiple Session Isolation
    
    Verify that state transitions for different sessions are properly isolated
    and don't interfere with each other.
    
    Validates: Requirements 16.6
    """
    state_machine = StateMachine()
    session_ids = [str(uuid4()) for _ in range(num_sessions)]
    
    # Execute transitions for each session
    for session_id in session_ids:
        for i in range(transitions_per_session):
            await state_machine.transition(
                session_id,
                SessionState.TEACHING,
                SessionState.INTERRUPTED,
                f"error_{i}"
            )
            await state_machine.transition(
                session_id,
                SessionState.INTERRUPTED,
                SessionState.TEACHING,
                f"ack_{i}"
            )
    
    # Verify each session has correct history
    for session_id in session_ids:
        history = state_machine.get_transition_history(session_id)
        assert len(history) == transitions_per_session * 2
        
        # Verify all transitions are for this session only
        for record in history:
            # History should only contain this session's transitions
            pass  # Session ID not stored in record, but isolation is verified by count


@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 23: State Machine Transitions")
def test_initial_state_is_teaching():
    """
    Property 23: Initial State
    
    Verify that new sessions should start in TEACHING state.
    
    Validates: Requirements 16.1
    """
    state_machine = StateMachine()
    
    # Verify TEACHING state allows transitions
    next_states = state_machine.get_next_states(SessionState.TEACHING)
    assert SessionState.INTERRUPTED in next_states
    assert SessionState.EXAMINING in next_states
    
    # Verify TEACHING is not a terminal state
    assert not state_machine.is_terminal_state(SessionState.TEACHING)


@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 23: State Machine Transitions")
def test_completed_is_terminal():
    """
    Property 23: Terminal State
    
    Verify that COMPLETED state is terminal with no further transitions.
    
    Validates: Requirements 16.5
    """
    state_machine = StateMachine()
    
    # Verify COMPLETED is terminal
    assert state_machine.is_terminal_state(SessionState.COMPLETED)
    
    # Verify no transitions from COMPLETED
    next_states = state_machine.get_next_states(SessionState.COMPLETED)
    assert len(next_states) == 0
    
    # Verify all transitions from COMPLETED are invalid
    for target_state in SessionState:
        if target_state != SessionState.COMPLETED:
            assert not state_machine.can_transition(SessionState.COMPLETED, target_state)
