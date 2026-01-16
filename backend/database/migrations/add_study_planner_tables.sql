-- ============================================================================
-- Medical AI Platform - Study Planner Database Schema
-- Smart Study Planner with AI-Powered Recommendations
-- ============================================================================

-- ============================================================================
-- STUDY PLAN ENTRIES TABLE
-- Core table for storing individual study plan items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.study_plan_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Subject & Topic Details
  subject TEXT NOT NULL,
  topic TEXT,
  study_type TEXT NOT NULL CHECK (study_type IN ('mcqs', 'flashcards', 'clinical_cases', 'revision', 'osce', 'reading', 'practice', 'conceptmap')),
  
  -- Scheduling
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (end_time - start_time)) / 60) STORED,
  
  -- Priority & Status
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped', 'rescheduled')),
  
  -- Performance Tracking
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  performance_score INTEGER CHECK (performance_score >= 0 AND performance_score <= 100),
  accuracy_percentage DECIMAL(5,2),
  
  -- Notes & Tags
  notes TEXT,
  tags TEXT[],
  color_code TEXT DEFAULT '#5C67F2',
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'biweekly', 'monthly')),
  parent_entry_id UUID REFERENCES public.study_plan_entries(id) ON DELETE SET NULL,
  
  -- AI & Automation
  ai_suggested BOOLEAN DEFAULT FALSE,
  ai_rescheduled BOOLEAN DEFAULT FALSE,
  original_scheduled_date DATE,
  reschedule_reason TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STUDY GOALS TABLE
-- Monthly/Weekly goals and milestones
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.study_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Goal Details
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('daily', 'weekly', 'monthly', 'custom')),
  
  -- Target Metrics
  target_hours DECIMAL(5,2),
  target_sessions INTEGER,
  target_topics INTEGER,
  target_accuracy DECIMAL(5,2),
  
  -- Progress
  current_hours DECIMAL(5,2) DEFAULT 0,
  current_sessions INTEGER DEFAULT 0,
  current_topics INTEGER DEFAULT 0,
  current_accuracy DECIMAL(5,2) DEFAULT 0,
  
  -- Period
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'paused')),
  achieved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PERFORMANCE METRICS TABLE
-- Track daily performance for analytics and AI recommendations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Date Tracking
  metric_date DATE NOT NULL,
  
  -- Study Time
  total_study_minutes INTEGER DEFAULT 0,
  planned_study_minutes INTEGER DEFAULT 0,
  
  -- Session Stats
  sessions_planned INTEGER DEFAULT 0,
  sessions_completed INTEGER DEFAULT 0,
  sessions_skipped INTEGER DEFAULT 0,
  
  -- Performance
  average_accuracy DECIMAL(5,2),
  mcqs_attempted INTEGER DEFAULT 0,
  mcqs_correct INTEGER DEFAULT 0,
  flashcards_reviewed INTEGER DEFAULT 0,
  
  -- Topics
  topics_covered TEXT[],
  weak_topics TEXT[],
  strong_topics TEXT[],
  
  -- Streak & Consistency
  is_streak_day BOOLEAN DEFAULT FALSE,
  consistency_score DECIMAL(5,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, metric_date)
);

-- ============================================================================
-- AI RECOMMENDATIONS TABLE
-- Store AI-generated study suggestions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Recommendation Details
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('optimal_time', 'weak_topic', 'revision', 'break', 'reschedule', 'goal_adjustment')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Suggested Action
  suggested_subject TEXT,
  suggested_study_type TEXT,
  suggested_start_time TIME,
  suggested_duration_minutes INTEGER,
  
  -- Context
  reasoning TEXT,
  confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  based_on_data JSONB,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  acted_upon_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STUDY STREAKS TABLE
-- Track user study streaks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.study_streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Current Streak
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  
  -- Streak Tracking
  last_study_date DATE,
  streak_start_date DATE,
  
  -- Weekly Stats
  days_studied_this_week INTEGER DEFAULT 0,
  days_studied_this_month INTEGER DEFAULT 0,
  
  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STUDY TEMPLATES TABLE
-- Reusable study plan templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.study_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Template Details
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  
  -- Template Structure
  template_data JSONB NOT NULL,
  
  -- Usage Stats
  times_used INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_study_plan_entries_user_date ON public.study_plan_entries(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_study_plan_entries_status ON public.study_plan_entries(status);
CREATE INDEX IF NOT EXISTS idx_study_plan_entries_user_status ON public.study_plan_entries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_study_goals_user_id ON public.study_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_study_goals_active ON public.study_goals(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_date ON public.performance_metrics(user_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_pending ON public.ai_recommendations(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_study_streaks_user_id ON public.study_streaks(user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_study_plan_entries_updated_at ON public.study_plan_entries;
CREATE TRIGGER update_study_plan_entries_updated_at 
  BEFORE UPDATE ON public.study_plan_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_study_goals_updated_at ON public.study_goals;
CREATE TRIGGER update_study_goals_updated_at 
  BEFORE UPDATE ON public.study_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_metrics_updated_at ON public.performance_metrics;
CREATE TRIGGER update_performance_metrics_updated_at 
  BEFORE UPDATE ON public.performance_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_study_streaks_updated_at ON public.study_streaks;
CREATE TRIGGER update_study_streaks_updated_at 
  BEFORE UPDATE ON public.study_streaks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Study Planner schema created successfully!' as status;
