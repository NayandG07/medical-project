CREATE TABLE IF NOT EXISTS public.image_analysis_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    image_filename TEXT NOT NULL,
    analysis_result JSONB NOT NULL,
    context TEXT,
    image_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.image_analysis_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own sessions" 
ON public.image_analysis_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions" 
ON public.image_analysis_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
ON public.image_analysis_sessions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
ON public.image_analysis_sessions FOR DELETE 
USING (auth.uid() = user_id);

-- Optional: Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_image_analysis_sessions_user_id ON public.image_analysis_sessions(user_id);
