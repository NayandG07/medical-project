-- Drop table if exists (to recreate with correct schema)
DROP TABLE IF EXISTS image_analysis_sessions CASCADE;

-- Create image_analysis_sessions table
CREATE TABLE image_analysis_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_filename TEXT NOT NULL,
    analysis_result JSONB NOT NULL,
    context TEXT,
    image_preview TEXT, -- Base64 encoded image for preview
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX idx_image_analysis_sessions_user_id ON image_analysis_sessions(user_id);

-- Create index on created_at for sorting
CREATE INDEX idx_image_analysis_sessions_created_at ON image_analysis_sessions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE image_analysis_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see only their own sessions
CREATE POLICY "Users can view their own image analysis sessions"
    ON image_analysis_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy for users to insert their own sessions
CREATE POLICY "Users can insert their own image analysis sessions"
    ON image_analysis_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy for users to delete their own sessions
CREATE POLICY "Users can delete their own image analysis sessions"
    ON image_analysis_sessions
    FOR DELETE
    USING (auth.uid() = user_id);
