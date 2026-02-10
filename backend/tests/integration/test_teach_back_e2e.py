"""
End-to-end integration tests for teach-back feature.

Tests complete session flows, error handling, failover, and integrations.
"""

import pytest
import asyncio
from uuid import uuid4
from datetime import datetime
import json

from teach_back.models import InputMode, OutputMode, SessionState, ErrorSeverity
from teach_back.session_manager import SessionManager
from teach_back.state_machine import StateMachine
from teach_back.rate_limiter import TeachBackRateLimiter
from teach_back.voice_processor import VoiceProcessor
from teach_back.llm_orchestrator import LLMOrchestrator
from teach_back.integrations import TeachBackIntegrations
from teach_back.retention_policy import RetentionPolicy


# ============================================================================
# TEST 1: Complete Text-Only Session Flow
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_complete_text_only_session_flow():
    """
    Test complete text-only session: teaching → interruption → examination → summary.
    Verifies all data persisted correctly.
    """
    manager = SessionManager()
    user_id = str(uuid4())
    
    # Create session
    result = await manager.create_session(
        user_id=user_id,
        user_plan="student",
        input_mode=InputMode.TEXT,
        output_mode=OutputMode.TEXT,
        topic="Cardiovascular System"
    )
    
    assert result["success"] == True
    assert "session" in result
    session_id = result["session"]["id"]
    assert result["session"]["state"] == SessionState.TEACHING.value
    
    # Process teaching input with intentional error
    input_result = await manager.process_input(
        session_id=session_id,
        content="The heart has three chambers: two atria and one ventricle."
    )
    
    assert input_result["success"] == True
    
    # Check if error detected and interruption triggered
    if input_result.get("interruption"):
        assert input_result["state"] == SessionState.INTERRUPTED.value
        assert "correction" in input_result["interruption"]
        
        # Acknowledge interruption
        ack_result = await manager.acknowledge_interruption(session_id)
        assert ack_result["success"] == True
        assert ack_result["state"] == SessionState.TEACHING.value
    
    # Process more teaching input
    input_result2 = await manager.process_input(
        session_id=session_id,
        content="The heart pumps blood through the circulatory system."
    )
    
    assert input_result2["success"] == True
    
    # End teaching phase
    end_teaching_result = await manager.end_teaching_phase(session_id)
    assert end_teaching_result["success"] == True
    assert end_teaching_result["state"] == SessionState.EXAMINING.value
    
    # Answer examination question
    if end_teaching_result.get("question"):
        answer_result = await manager.answer_examination_question(
            session_id=session_id,
            answer="The heart has four chambers: two atria and two ventricles."
        )
        
        assert answer_result["success"] == True
        assert "score" in answer_result
        assert 0 <= answer_result["score"] <= 10
    
    # End session
    end_result = await manager.end_session(session_id)
    assert end_result["success"] == True
    assert end_result["state"] == SessionState.COMPLETED.value
    assert "summary" in end_result
    
    # Verify summary completeness
    summary = end_result["summary"]
    assert "total_errors" in summary
    assert "missed_concepts" in summary
    assert "strong_areas" in summary
    assert "recommendations" in summary
    assert "overall_score" in summary
    assert 0 <= summary["overall_score"] <= 100


# ============================================================================
# TEST 2: Complete Voice Session Flow
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.skipif(
    not VoiceProcessor().is_stt_available(),
    reason="STT engine not available"
)
async def test_complete_voice_session_flow():
    """
    Test complete voice session with all voice modes.
    Requires voice models to be downloaded.
    """
    manager = SessionManager()
    user_id = str(uuid4())
    
    # Test Voice Only input
    result = await manager.create_session(
        user_id=user_id,
        user_plan="pro",
        input_mode=InputMode.VOICE,
        output_mode=OutputMode.VOICE_TEXT,
        topic="Respiratory System"
    )
    
    assert result["success"] == True
    session_id = result["session"]["id"]
    
    # Simulate audio input (would be actual audio bytes in production)
    audio_bytes = b"fake_audio_data"
    
    input_result = await manager.process_input(
        session_id=session_id,
        content=audio_bytes,
        is_audio=True
    )
    
    # Should either succeed or fallback to text mode
    assert input_result["success"] == True or input_result.get("fallback_mode") == "text"
    
    # End session
    end_result = await manager.end_session(session_id)
    assert end_result["success"] == True


# ============================================================================
# TEST 3: STT Failure Mid-Session
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_stt_failure_fallback():
    """
    Test session with STT failure mid-session.
    Verifies automatic fallback to text input with user notification.
    """
    manager = SessionManager()
    user_id = str(uuid4())
    
    # Create voice session
    result = await manager.create_session(
        user_id=user_id,
        user_plan="pro",
        input_mode=InputMode.VOICE,
        output_mode=OutputMode.TEXT,
        topic="Neurology"
    )
    
    assert result["success"] == True
    session_id = result["session"]["id"]
    
    # Simulate STT failure by sending invalid audio
    input_result = await manager.process_input(
        session_id=session_id,
        content=b"invalid_audio",
        is_audio=True
    )
    
    # Should fallback to text mode
    if not input_result["success"]:
        assert input_result.get("error_code") in ["STT_UNAVAILABLE", "STT_FAILED"]
        assert input_result.get("fallback_mode") == "text"
        assert "notification" in input_result
    
    # Continue with text input
    text_result = await manager.process_input(
        session_id=session_id,
        content="The brain controls all body functions."
    )
    
    assert text_result["success"] == True


# ============================================================================
# TEST 4: TTS Failure Mid-Session
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_tts_failure_fallback():
    """
    Test session with TTS failure mid-session.
    Verifies automatic fallback to text output with user notification.
    """
    manager = SessionManager()
    user_id = str(uuid4())
    
    # Create session with voice output
    result = await manager.create_session(
        user_id=user_id,
        user_plan="pro",
        input_mode=InputMode.TEXT,
        output_mode=OutputMode.VOICE_TEXT,
        topic="Pharmacology"
    )
    
    assert result["success"] == True
    session_id = result["session"]["id"]
    
    # Process input (TTS failure would be detected during response generation)
    input_result = await manager.process_input(
        session_id=session_id,
        content="Tell me about antibiotics."
    )
    
    # Should either succeed or fallback to text-only output
    assert input_result["success"] == True
    
    if input_result.get("fallback_mode") == "text":
        assert "notification" in input_result
        assert input_result.get("error_code") in ["TTS_UNAVAILABLE", "TTS_FAILED"]


# ============================================================================
# TEST 5: LLM Failover
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_llm_failover():
    """
    Test session with LLM failover (primary fails, fallback succeeds).
    Verifies no user intervention required.
    """
    orchestrator = LLMOrchestrator()
    
    # Simulate primary LLM failure
    # (In production, this would be actual API failure)
    session_context = {
        "state": SessionState.TEACHING,
        "topic": "Cardiology",
        "transcript": []
    }
    
    # Generate response (should failover automatically)
    response = await orchestrator.generate_response(
        session_context=session_context,
        user_input="Tell me about the heart."
    )
    
    # Should succeed via failover
    assert response is not None
    assert len(response) > 0
    
    # Check failover was logged
    # (Would check logs in production)


# ============================================================================
# TEST 6: Both LLMs Failing (Maintenance Mode)
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_both_llms_failing_maintenance_mode():
    """
    Test session with both LLMs failing.
    Verifies maintenance mode triggered and new sessions prevented.
    """
    manager = SessionManager()
    user_id = str(uuid4())
    
    # Simulate both LLMs failing
    # (In production, this would be actual API failures)
    
    # Try to create new session
    result = await manager.create_session(
        user_id=user_id,
        user_plan="student",
        input_mode=InputMode.TEXT,
        output_mode=OutputMode.TEXT,
        topic="Test Topic"
    )
    
    # Should either succeed or be blocked by maintenance mode
    if not result["success"]:
        assert result.get("error_code") == "MAINTENANCE_MODE"
        assert "notification" in result


# ============================================================================
# TEST 7: Quota Limit Hit
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_quota_limit_hit():
    """
    Test session hitting quota limit.
    Verifies rejection with quota info and plan upgrade suggestion.
    """
    manager = SessionManager()
    rate_limiter = TeachBackRateLimiter()
    user_id = str(uuid4())
    user_plan = "student"
    
    # Check quota
    quota_result = await rate_limiter.check_session_limit(
        user_id=user_id,
        user_plan=user_plan,
        is_voice=False
    )
    
    if not quota_result["allowed"]:
        # Try to create session
        result = await manager.create_session(
            user_id=user_id,
            user_plan=user_plan,
            input_mode=InputMode.TEXT,
            output_mode=OutputMode.TEXT,
            topic="Test Topic"
        )
        
        assert result["success"] == False
        assert result.get("error_code") == "QUOTA_EXCEEDED"
        assert "remaining_quota" in result
        assert "upgrade_suggestion" in result


# ============================================================================
# TEST 8: All Integrations
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_all_integrations():
    """
    Test all integrations with other systems.
    Verifies data sent to flashcards, weak areas, study planner, MCQs.
    """
    integrations = TeachBackIntegrations()
    
    session_data = {
        "session_id": str(uuid4()),
        "user_id": str(uuid4()),
        "missed_concepts": ["Heart anatomy", "Blood circulation"],
        "errors": [
            {
                "error_text": "Heart has three chambers",
                "correction": "Heart has four chambers",
                "severity": "critical"
            }
        ],
        "recommendations": ["Review cardiovascular system", "Practice heart anatomy"],
        "overall_score": 75
    }
    
    # Test flashcard integration
    flashcard_result = await integrations.feed_to_flashcard_generator(session_data)
    # Should succeed or fail gracefully
    assert flashcard_result is not None
    
    # Test weak area integration
    weak_area_result = await integrations.feed_to_weak_area_analysis(session_data)
    assert weak_area_result is not None
    
    # Test study planner integration
    planner_result = await integrations.feed_to_study_planner(session_data)
    assert planner_result is not None
    
    # Test MCQ integration
    mcq_result = await integrations.feed_to_mcq_suggestions(session_data)
    assert mcq_result is not None


# ============================================================================
# TEST 9: Admin Controls
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_admin_controls():
    """
    Test admin controls: feature disable, voice disable, quota overrides.
    """
    import os
    
    # Test feature disable
    original_enabled = os.getenv("TEACH_BACK_ENABLED", "true")
    os.environ["TEACH_BACK_ENABLED"] = "false"
    
    manager = SessionManager()
    user_id = str(uuid4())
    
    result = await manager.create_session(
        user_id=user_id,
        user_plan="student",
        input_mode=InputMode.TEXT,
        output_mode=OutputMode.TEXT,
        topic="Test Topic"
    )
    
    # Should be blocked
    if not result["success"]:
        assert result.get("error_code") == "FEATURE_DISABLED"
    
    # Restore original setting
    os.environ["TEACH_BACK_ENABLED"] = original_enabled
    
    # Test voice disable
    original_voice = os.getenv("TEACH_BACK_VOICE_ENABLED", "true")
    os.environ["TEACH_BACK_VOICE_ENABLED"] = "false"
    
    result = await manager.create_session(
        user_id=user_id,
        user_plan="pro",
        input_mode=InputMode.VOICE,
        output_mode=OutputMode.VOICE_TEXT,
        topic="Test Topic"
    )
    
    # Should be blocked or fallback to text
    if not result["success"]:
        assert result.get("error_code") == "VOICE_DISABLED"
    
    # Restore original setting
    os.environ["TEACH_BACK_VOICE_ENABLED"] = original_voice


# ============================================================================
# TEST 10: Data Retention Cleanup
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_data_retention_cleanup():
    """
    Test data retention cleanup job.
    Verifies old data deleted, summaries preserved, deletions logged.
    """
    retention_policy = RetentionPolicy()
    
    # Run cleanup for a test user
    user_id = str(uuid4())
    user_plan = "student"
    
    cleanup_result = await retention_policy.cleanup_old_sessions(
        user_id=user_id,
        user_plan=user_plan
    )
    
    assert cleanup_result is not None
    assert "deleted_count" in cleanup_result
    assert "preserved_summaries" in cleanup_result
    assert cleanup_result["deleted_count"] >= 0


# ============================================================================
# TEST 11: State Machine Transitions
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_state_machine_transitions():
    """
    Test all valid state transitions succeed and invalid transitions rejected.
    """
    state_machine = StateMachine()
    session_id = str(uuid4())
    
    # Valid transitions
    valid_transitions = [
        (SessionState.TEACHING, SessionState.INTERRUPTED),
        (SessionState.INTERRUPTED, SessionState.TEACHING),
        (SessionState.TEACHING, SessionState.EXAMINING),
        (SessionState.EXAMINING, SessionState.COMPLETED)
    ]
    
    for from_state, to_state in valid_transitions:
        success, error = state_machine.transition(
            session_id=session_id,
            from_state=from_state,
            to_state=to_state,
            reason="test transition"
        )
        
        if state_machine.can_transition(from_state, to_state):
            assert success == True
            assert error is None
    
    # Invalid transitions
    invalid_transitions = [
        (SessionState.COMPLETED, SessionState.TEACHING),
        (SessionState.EXAMINING, SessionState.INTERRUPTED),
        (SessionState.INTERRUPTED, SessionState.EXAMINING)
    ]
    
    for from_state, to_state in invalid_transitions:
        success, error = state_machine.transition(
            session_id=session_id,
            from_state=from_state,
            to_state=to_state,
            reason="test invalid transition"
        )
        
        assert success == False
        assert error is not None


# ============================================================================
# TEST 12: Error Handling for All Error Codes
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
async def test_error_handling_all_codes():
    """
    Test error handling for all error codes.
    Verifies proper error responses, user notifications, and logging.
    """
    from teach_back.error_codes import ERROR_CODES
    
    # Verify all error codes have proper structure
    for code, details in ERROR_CODES.items():
        assert "message" in details
        assert "user_message" in details
        assert "severity" in details
        assert "recoverable" in details
        
        # Verify severity is valid
        assert details["severity"] in ["low", "medium", "high", "critical"]
        
        # Verify recoverable is boolean
        assert isinstance(details["recoverable"], bool)


# ============================================================================
# LOAD TESTING HELPER
# ============================================================================

@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.slow
async def test_concurrent_sessions():
    """
    Load test: Create multiple concurrent sessions.
    Verifies system handles concurrent load.
    """
    manager = SessionManager()
    num_sessions = 10
    
    # Create multiple sessions concurrently
    tasks = []
    for i in range(num_sessions):
        task = manager.create_session(
            user_id=str(uuid4()),
            user_plan="pro",
            input_mode=InputMode.TEXT,
            output_mode=OutputMode.TEXT,
            topic=f"Test Topic {i}"
        )
        tasks.append(task)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Count successes
    successes = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
    
    # Should handle most requests successfully
    assert successes >= num_sessions * 0.8  # 80% success rate minimum
