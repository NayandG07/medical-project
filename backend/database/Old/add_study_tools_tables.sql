-- Add Study Tools Tables
-- Run this in Supabase SQL Editor to add the new study tools functionality

-- Study tool sessions table (separate from chat sessions)
CREATE TABLE IF NOT EXISTS public.study_tool_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('flashcard', 'mcq', 'highyield', 'explain', 'map')),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Study materials table (stores generated content)
CREATE TABLE IF NOT EXISTS public.study_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.study_tool_sessions(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('flashcard', 'mcq', 'highyield', 'explain', 'map')),
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_study_tool_sessions_user_feature ON public.study_tool_sessions(user_id, feature);
CREATE INDEX IF NOT EXISTS idx_study_tool_sessions_updated ON public.study_tool_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_materials_session ON public.study_materials(session_id, created_at);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_study_tool_sessions_updated_at ON public.study_tool_sessions;
CREATE TRIGGER update_study_tool_sessions_updated_at BEFORE UPDATE ON public.study_tool_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Study tools tables created successfully!' as status;
