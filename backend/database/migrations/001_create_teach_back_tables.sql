-- ============================================================================
-- TEACH-BACK FEATURE - DATABASE MIGRATION
-- Version: 001
-- Date: 2026-02-07
-- Description: Creates all tables for Interactive Learning Assistant feature
-- ============================================================================

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TEACH-BACK SESSIONS TABLE
-- Stores main session data with input/output modes and state
-- ============================================================================
CREATE TABLE IF NOT EXISTS teach_back_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT,
    input_mode VARCHAR(20) NOT NULL CHECK (input_mode IN ('text', 'voice', 'mixed')),
    output_mode VARCHAR(20) NOT NULL CHECK (output_mode IN ('text', 'voice_text')),
    state VARCHAR(20) NOT NULL CHECK (state IN ('teaching', 'interrupted', 'examining', 'completed')),
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_teach_back_sessions_user_id ON teach_back_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_teach_back_sessions_state ON teach_back_sessions(state);
CREATE INDEX IF NOT EXISTS idx_teach_back_sessions_created_at ON teach_back_sessions(created_at);

-- ============================================================================
-- TEACH-BACK TRANSCRIPTS TABLE
-- Stores complete text transcript of all interactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS teach_back_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL CHECK (speaker IN ('user', 'system')),
    content TEXT NOT NULL,
    is_voice BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teach_back_transcripts_session_id ON teach_back_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_teach_back_transcripts_timestamp ON teach_back_transcripts(timestamp);

-- ============================================================================
-- TEACH-BACK ERRORS TABLE
-- Stores detected errors with corrections and context
-- ============================================================================
CREATE TABLE IF NOT EXISTS teach_back_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    error_text TEXT NOT NULL,
    correction TEXT NOT NULL,
    context TEXT,
    severity VARCHAR(20) CHECK (severity IN ('minor', 'moderate', 'critical')),
    detected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teach_back_errors_session_id ON teach_back_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_teach_back_errors_severity ON teach_back_errors(severity);

-- ============================================================================
-- TEACH-BACK EXAMINATIONS TABLE
-- Stores examination questions, answers, and evaluations
-- ============================================================================
CREATE TABLE IF NOT EXISTS teach_back_examinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    user_answer TEXT,
    evaluation TEXT,
    score INTEGER CHECK (score >= 0 AND score <= 10),
    asked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teach_back_examinations_session_id ON teach_back_examinations(session_id);

-- ============================================================================
-- TEACH-BACK SUMMARIES TABLE
-- Stores comprehensive session summaries
-- ============================================================================
CREATE TABLE IF NOT EXISTS teach_back_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES teach_back_sessions(id) ON DELETE CASCADE,
    total_errors INTEGER NOT NULL DEFAULT 0,
    missed_concepts TEXT[],
    strong_areas TEXT[],
    recommendations TEXT[],
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teach_back_summaries_session_id ON teach_back_summaries(session_id);

-- ============================================================================
-- TEACH-BACK USAGE TABLE
-- Tracks rate limiting for teach-back sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS teach_back_usage (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    text_sessions INTEGER DEFAULT 0,
    voice_sessions INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_teach_back_usage_date ON teach_back_usage(date);

-- ============================================================================
-- TRIGGERS
-- Auto-update updated_at timestamp on sessions table
-- ============================================================================
CREATE OR REPLACE FUNCTION update_teach_back_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_teach_back_sessions_updated_at ON teach_back_sessions;
CREATE TRIGGER trigger_update_teach_back_sessions_updated_at
    BEFORE UPDATE ON teach_back_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_teach_back_sessions_updated_at();

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (for reference - run separately if needed)
-- ============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trigger_update_teach_back_sessions_updated_at ON teach_back_sessions;
-- DROP FUNCTION IF EXISTS update_teach_back_sessions_updated_at();
-- DROP TABLE IF EXISTS teach_back_usage CASCADE;
-- DROP TABLE IF EXISTS teach_back_summaries CASCADE;
-- DROP TABLE IF EXISTS teach_back_examinations CASCADE;
-- DROP TABLE IF EXISTS teach_back_errors CASCADE;
-- DROP TABLE IF EXISTS teach_back_transcripts CASCADE;
-- DROP TABLE IF EXISTS teach_back_sessions CASCADE;
-- COMMIT;
