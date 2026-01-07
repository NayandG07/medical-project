-- Migration: Model Usage Logs Table
-- Purpose: Track all model API calls for monitoring, reporting, and cost analysis
-- Requirements: Admin visibility, fallback monitoring, cost tracking

-- Create model_usage_logs table
CREATE TABLE IF NOT EXISTS model_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,  -- openrouter, huggingface, gemini, etc.
    model TEXT NOT NULL,  -- Specific model name
    feature TEXT NOT NULL,  -- chat, flashcard, mcq, etc.
    success BOOLEAN NOT NULL DEFAULT false,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    error TEXT,  -- Error message if failed
    key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,  -- Which API key was used
    was_fallback BOOLEAN NOT NULL DEFAULT false,  -- Was this a fallback attempt?
    attempt_number INTEGER NOT NULL DEFAULT 1,  -- Attempt number (1, 2, 3, etc.)
    response_time_ms INTEGER,  -- Response time in milliseconds
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_timestamp ON model_usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_user_id ON model_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_provider ON model_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_feature ON model_usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_success ON model_usage_logs(success);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_was_fallback ON model_usage_logs(was_fallback);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_key_id ON model_usage_logs(key_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_provider_feature ON model_usage_logs(provider, feature);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_timestamp_provider ON model_usage_logs(timestamp DESC, provider);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_timestamp_feature ON model_usage_logs(timestamp DESC, feature);

-- Enable Row Level Security
ALTER TABLE model_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all logs
CREATE POLICY "Admins can view all model usage logs"
    ON model_usage_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Policy: Users can view their own logs
CREATE POLICY "Users can view their own model usage logs"
    ON model_usage_logs
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: Service role can insert logs
CREATE POLICY "Service role can insert model usage logs"
    ON model_usage_logs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE model_usage_logs IS 'Logs all model API calls for monitoring and cost tracking';
COMMENT ON COLUMN model_usage_logs.provider IS 'Provider name (openrouter, huggingface, etc.)';
COMMENT ON COLUMN model_usage_logs.model IS 'Specific model used (e.g., claude-sonnet-4.5, meditron-7b)';
COMMENT ON COLUMN model_usage_logs.feature IS 'Feature that triggered the call (chat, flashcard, etc.)';
COMMENT ON COLUMN model_usage_logs.was_fallback IS 'True if this was a fallback attempt after primary key failed';
COMMENT ON COLUMN model_usage_logs.attempt_number IS 'Attempt number in the fallback chain (1 = first try)';
COMMENT ON COLUMN model_usage_logs.key_id IS 'API key ID that was used for this call';
