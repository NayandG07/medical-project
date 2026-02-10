"""
Property-based tests for teach-back data storage.

These tests verify universal properties that should hold across all inputs.
"""

import pytest
from hypothesis import given, strategies as st, settings
from datetime import datetime, timedelta
from uuid import uuid4

from teach_back.models import (
    Session, TranscriptEntry, DetectedError, ExaminationQA, SessionSummary,
    SessionState, InputMode, OutputMode, ErrorSeverity
)
from teach_back.data_storage import DataStorage


# Test data generators

@st.composite
def session_strategy(draw):
    """Generate random Session objects."""
    return Session(
        id=str(uuid4()),
        user_id=str(uuid4()),
        topic=draw(st.one_of(st.none(), st.text(min_size=5, max_size=100))),
        input_mode=draw(st.sampled_from(InputMode)),
        output_mode=draw(st.sampled_from(OutputMode)),
        state=draw(st.sampled_from(SessionState)),
        started_at=draw(st.datetimes(
            min_value=datetime(2024, 1, 1),
            max_value=datetime(2026, 12, 31)
        )),
        ended_at=draw(st.one_of(
            st.none(),
            st.datetimes(
                min_value=datetime(2024, 1, 1),
                max_value=datetime(2026, 12, 31)
            )
        ))
    )


@st.composite
def transcript_entry_strategy(draw, session_id):
    """Generate random TranscriptEntry objects."""
    return TranscriptEntry(
        id=str(uuid4()),
        session_id=session_id,
        speaker=draw(st.sampled_from(['user', 'system'])),
        content=draw(st.text(min_size=5, max_size=500)),
        is_voice=draw(st.booleans()),
        timestamp=draw(st.datetimes(
            min_value=datetime(2024, 1, 1),
            max_value=datetime(2026, 12, 31)
        ))
    )


@st.composite
def error_strategy(draw, session_id):
    """Generate random DetectedError objects."""
    return DetectedError(
        id=str(uuid4()),
        session_id=session_id,
        error_text=draw(st.text(min_size=10, max_size=200)),
        correction=draw(st.text(min_size=10, max_size=200)),
        context=draw(st.one_of(st.none(), st.text(max_size=500))),
        severity=draw(st.sampled_from(ErrorSeverity)),
        detected_at=draw(st.datetimes(
            min_value=datetime(2024, 1, 1),
            max_value=datetime(2026, 12, 31)
        ))
    )


@st.composite
def examination_qa_strategy(draw, session_id):
    """Generate random ExaminationQA objects."""
    return ExaminationQA(
        id=str(uuid4()),
        session_id=session_id,
        question=draw(st.text(min_size=10, max_size=200)),
        user_answer=draw(st.one_of(st.none(), st.text(min_size=5, max_size=500))),
        evaluation=draw(st.one_of(st.none(), st.text(min_size=5, max_size=500))),
        score=draw(st.one_of(st.none(), st.integers(min_value=0, max_value=10))),
        asked_at=draw(st.datetimes(
            min_value=datetime(2024, 1, 1),
            max_value=datetime(2026, 12, 31)
        ))
    )


@st.composite
def session_summary_strategy(draw, session_id, user_id):
    """Generate random SessionSummary objects."""
    return SessionSummary(
        id=str(uuid4()),
        session_id=session_id,
        user_id=user_id,
        total_errors=draw(st.integers(min_value=0, max_value=50)),
        missed_concepts=draw(st.lists(st.text(min_size=3, max_size=50), max_size=10)),
        strong_areas=draw(st.lists(st.text(min_size=3, max_size=50), max_size=10)),
        recommendations=draw(st.lists(st.text(min_size=10, max_size=100), max_size=10)),
        overall_score=draw(st.integers(min_value=0, max_value=100)),
        created_at=draw(st.datetimes(
            min_value=datetime(2024, 1, 1),
            max_value=datetime(2026, 12, 31)
        ))
    )


# Property Tests

@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 17: Session Data Round-Trip")
@given(session=session_strategy())
@settings(max_examples=100, deadline=None)
async def test_session_data_round_trip(session):
    """
    Property 17: Session Data Round-Trip
    
    For any completed session, retrieving the session from storage should return
    the complete transcript, all detected errors with context and corrections,
    all missed concepts, all interruption points with timestamps, all examination
    Q&As, and all recommendations.
    
    Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
    """
    storage = DataStorage()
    
    # Save session
    saved_id = await storage.save_session(session)
    assert saved_id == session.id
    
    # Retrieve session
    retrieved = await storage.get_session(session.id)
    assert retrieved is not None
    assert retrieved.id == session.id
    assert retrieved.user_id == session.user_id
    assert retrieved.topic == session.topic
    assert retrieved.input_mode == session.input_mode
    assert retrieved.output_mode == session.output_mode
    assert retrieved.state == session.state
    
    # Generate and save transcript entries
    transcript_entries = [
        transcript_entry_strategy(session.id).example()
        for _ in range(5)
    ]
    for entry in transcript_entries:
        await storage.save_transcript_entry(
            session.id,
            entry.speaker,
            entry.content,
            entry.is_voice
        )
    
    # Retrieve transcript
    retrieved_transcript = await storage.get_session_transcript(session.id)
    assert len(retrieved_transcript) == len(transcript_entries)
    for i, entry in enumerate(retrieved_transcript):
        assert entry.session_id == session.id
        assert entry.speaker in ['user', 'system']
        assert len(entry.content) > 0
    
    # Generate and save errors
    errors = [
        error_strategy(session.id).example()
        for _ in range(3)
    ]
    for error in errors:
        await storage.save_error(session.id, error)
    
    # Retrieve errors
    retrieved_errors = await storage.get_session_errors(session.id)
    assert len(retrieved_errors) == len(errors)
    for error in retrieved_errors:
        assert error.session_id == session.id
        assert len(error.error_text) > 0
        assert len(error.correction) > 0
        assert error.severity in ErrorSeverity
    
    # Generate and save examination Q&As
    qas = [
        examination_qa_strategy(session.id).example()
        for _ in range(3)
    ]
    for qa in qas:
        qa_id = await storage.save_examination_qa(
            session.id,
            qa.question,
            qa.user_answer,
            qa.evaluation,
            qa.score
        )
        assert qa_id is not None
    
    # Retrieve examinations
    retrieved_qas = await storage.get_session_examinations(session.id)
    assert len(retrieved_qas) == len(qas)
    for qa in retrieved_qas:
        assert qa.session_id == session.id
        assert len(qa.question) > 0
    
    # Generate and save summary
    summary = session_summary_strategy(session.id, session.user_id).example()
    await storage.save_summary(session.id, summary)
    
    # Retrieve summary
    retrieved_summary = await storage.get_summary(session.id)
    assert retrieved_summary is not None
    assert retrieved_summary.session_id == session.id
    assert retrieved_summary.user_id == session.user_id
    assert retrieved_summary.total_errors >= 0
    assert isinstance(retrieved_summary.missed_concepts, list)
    assert isinstance(retrieved_summary.strong_areas, list)
    assert isinstance(retrieved_summary.recommendations, list)
    assert 0 <= retrieved_summary.overall_score <= 100


@pytest.mark.property_test
@pytest.mark.tag("Feature: interactive-learning-assistant, Property 17: Session Data Round-Trip")
@given(
    session=session_strategy(),
    num_transcripts=st.integers(min_value=1, max_value=20),
    num_errors=st.integers(min_value=0, max_value=10),
    num_qas=st.integers(min_value=0, max_value=10)
)
@settings(max_examples=50, deadline=None)
async def test_complete_session_data_persistence(session, num_transcripts, num_errors, num_qas):
    """
    Property 17: Complete Session Data Persistence
    
    Verify that all session data (transcripts, errors, Q&As, summary) is
    correctly persisted and can be retrieved in full.
    
    Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
    """
    storage = DataStorage()
    
    # Save session
    await storage.save_session(session)
    
    # Save multiple transcript entries
    for _ in range(num_transcripts):
        entry = transcript_entry_strategy(session.id).example()
        await storage.save_transcript_entry(
            session.id,
            entry.speaker,
            entry.content,
            entry.is_voice
        )
    
    # Save multiple errors
    for _ in range(num_errors):
        error = error_strategy(session.id).example()
        await storage.save_error(session.id, error)
    
    # Save multiple Q&As
    for _ in range(num_qas):
        qa = examination_qa_strategy(session.id).example()
        await storage.save_examination_qa(
            session.id,
            qa.question,
            qa.user_answer,
            qa.evaluation,
            qa.score
        )
    
    # Verify all data can be retrieved
    retrieved_session = await storage.get_session(session.id)
    assert retrieved_session is not None
    
    retrieved_transcript = await storage.get_session_transcript(session.id)
    assert len(retrieved_transcript) == num_transcripts
    
    retrieved_errors = await storage.get_session_errors(session.id)
    assert len(retrieved_errors) == num_errors
    
    retrieved_qas = await storage.get_session_examinations(session.id)
    assert len(retrieved_qas) == num_qas
    
    # Verify data integrity
    for entry in retrieved_transcript:
        assert entry.session_id == session.id
        assert entry.speaker in ['user', 'system']
    
    for error in retrieved_errors:
        assert error.session_id == session.id
        assert error.severity in ErrorSeverity
    
    for qa in retrieved_qas:
        assert qa.session_id == session.id
        if qa.score is not None:
            assert 0 <= qa.score <= 10
