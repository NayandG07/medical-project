-- Clinical Reasoning Engine Database Migration
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Create the update_updated_at_column function if it doesn't exist
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Create Clinical Cases Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Case Metadata
  case_type TEXT NOT NULL DEFAULT 'clinical_reasoning' CHECK (case_type IN ('clinical_reasoning', 'osce', 'diagnostic_challenge')),
  specialty TEXT NOT NULL DEFAULT 'general_medicine',
  difficulty TEXT NOT NULL DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  
  -- Patient Demographics
  patient_demographics JSONB NOT NULL DEFAULT '{}',
  
  -- Case Content (Progressive Disclosure)
  chief_complaint TEXT NOT NULL,
  history_of_present_illness JSONB DEFAULT '{}',
  past_medical_history JSONB DEFAULT '{}',
  family_history JSONB DEFAULT '{}',
  social_history JSONB DEFAULT '{}',
  review_of_systems JSONB DEFAULT '{}',
  physical_examination JSONB DEFAULT '{}',
  vital_signs JSONB DEFAULT '{}',
  initial_investigations JSONB DEFAULT '{}',
  imaging_results JSONB DEFAULT '{}',
  additional_investigations JSONB DEFAULT '{}',
  
  -- Case Stages and Progression
  stages JSONB NOT NULL DEFAULT '[]',
  current_stage INTEGER NOT NULL DEFAULT 0,
  stage_unlock_history JSONB DEFAULT '[]',
  
  -- Correct Answers (Hidden from user)
  differential_diagnoses JSONB DEFAULT '[]',
  final_diagnosis TEXT,
  diagnosis_explanation TEXT,
  management_plan JSONB DEFAULT '{}',
  red_flags TEXT[],
  clinical_pearls TEXT[],
  
  -- Timing
  time_started TIMESTAMPTZ DEFAULT NOW(),
  time_completed TIMESTAMPTZ,
  total_time_seconds INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_cases_user_id ON public.clinical_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_clinical_cases_status ON public.clinical_cases(status);
CREATE INDEX IF NOT EXISTS idx_clinical_cases_specialty ON public.clinical_cases(specialty);
CREATE INDEX IF NOT EXISTS idx_clinical_cases_created_at ON public.clinical_cases(created_at DESC);

DROP TRIGGER IF EXISTS update_clinical_cases_updated_at ON public.clinical_cases;
CREATE TRIGGER update_clinical_cases_updated_at BEFORE UPDATE ON public.clinical_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 3: Create Clinical Reasoning Steps Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_reasoning_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.clinical_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Step Information
  step_type TEXT NOT NULL CHECK (step_type IN (
    'problem_representation',
    'differential_generation',
    'diagnostic_justification', 
    'investigation_planning',
    'final_diagnosis',
    'management_plan',
    'history_question',
    'examination_request',
    'investigation_request',
    'clarification_request'
  )),
  step_number INTEGER NOT NULL,
  
  -- User Input
  user_input TEXT NOT NULL,
  user_notes TEXT,
  
  -- AI Evaluation
  ai_evaluation JSONB DEFAULT '{}',
  score DECIMAL(5,2),
  
  -- Timing
  time_taken_seconds INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reasoning_steps_case_id ON public.clinical_reasoning_steps(case_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_steps_user_id ON public.clinical_reasoning_steps(user_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_steps_step_type ON public.clinical_reasoning_steps(step_type);

-- ============================================================================
-- STEP 4: Create OSCE Scenarios Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.osce_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Scenario Metadata
  scenario_type TEXT NOT NULL CHECK (scenario_type IN (
    'history_taking',
    'physical_examination',
    'communication_skills',
    'clinical_procedure',
    'data_interpretation',
    'counseling',
    'emergency_management'
  )),
  specialty TEXT NOT NULL DEFAULT 'general_medicine',
  difficulty TEXT NOT NULL DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  
  -- Candidate Instructions
  candidate_instructions TEXT NOT NULL,
  time_limit_seconds INTEGER NOT NULL DEFAULT 480,
  
  -- Patient Information
  patient_info JSONB NOT NULL DEFAULT '{}',
  patient_script JSONB NOT NULL DEFAULT '{}',
  
  -- Examiner Configuration
  examiner_checklist JSONB NOT NULL DEFAULT '[]',
  expected_actions JSONB DEFAULT '[]',
  
  -- Interaction History
  interaction_history JSONB DEFAULT '[]',
  
  -- Scoring
  global_rating_score DECIMAL(5,2),
  checklist_score DECIMAL(5,2),
  communication_score DECIMAL(5,2),
  clinical_competence_score DECIMAL(5,2),
  
  -- Timing
  time_started TIMESTAMPTZ DEFAULT NOW(),
  time_completed TIMESTAMPTZ,
  actual_time_seconds INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osce_scenarios_user_id ON public.osce_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_osce_scenarios_status ON public.osce_scenarios(status);
CREATE INDEX IF NOT EXISTS idx_osce_scenarios_type ON public.osce_scenarios(scenario_type);

DROP TRIGGER IF EXISTS update_osce_scenarios_updated_at ON public.osce_scenarios;
CREATE TRIGGER update_osce_scenarios_updated_at BEFORE UPDATE ON public.osce_scenarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: Create Clinical Performance Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Aggregate Metrics
  total_cases_attempted INTEGER NOT NULL DEFAULT 0,
  total_cases_completed INTEGER NOT NULL DEFAULT 0,
  total_osce_attempted INTEGER NOT NULL DEFAULT 0,
  total_osce_completed INTEGER NOT NULL DEFAULT 0,
  
  -- Average Scores
  avg_diagnostic_accuracy DECIMAL(5,2) DEFAULT 0,
  avg_clinical_reasoning DECIMAL(5,2) DEFAULT 0,
  avg_data_gathering DECIMAL(5,2) DEFAULT 0,
  avg_communication DECIMAL(5,2) DEFAULT 0,
  avg_time_efficiency DECIMAL(5,2) DEFAULT 0,
  
  -- Performance by Specialty
  specialty_scores JSONB DEFAULT '{}',
  
  -- Cognitive Bias Tracking
  cognitive_biases_detected JSONB DEFAULT '[]',
  
  -- Skill Progression
  skill_progression JSONB DEFAULT '{}',
  
  -- Weakness Analysis
  identified_weaknesses TEXT[],
  recommended_topics TEXT[],
  
  -- Streaks and Achievements
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_clinical_performance_user_id ON public.clinical_performance(user_id);

DROP TRIGGER IF EXISTS update_clinical_performance_updated_at ON public.clinical_performance;
CREATE TRIGGER update_clinical_performance_updated_at BEFORE UPDATE ON public.clinical_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: Create Clinical Rubrics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_rubrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Rubric Metadata
  rubric_name TEXT NOT NULL,
  rubric_type TEXT NOT NULL CHECK (rubric_type IN ('clinical_reasoning', 'osce', 'communication', 'procedure')),
  specialty TEXT,
  
  -- Scoring Criteria
  criteria JSONB NOT NULL DEFAULT '[]',
  
  -- Weighting
  total_weight DECIMAL(5,2) DEFAULT 100,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_clinical_rubrics_updated_at ON public.clinical_rubrics;
CREATE TRIGGER update_clinical_rubrics_updated_at BEFORE UPDATE ON public.clinical_rubrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Create Case Templates Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.case_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Template Metadata
  template_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  case_type TEXT NOT NULL CHECK (case_type IN ('clinical_reasoning', 'osce', 'diagnostic_challenge')),
  
  -- Template Content
  template_data JSONB NOT NULL DEFAULT '{}',
  
  -- Learning Objectives
  learning_objectives TEXT[],
  target_skills TEXT[],
  
  -- Metadata
  times_used INTEGER DEFAULT 0,
  avg_completion_rate DECIMAL(5,2) DEFAULT 0,
  avg_score DECIMAL(5,2) DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_templates_specialty ON public.case_templates(specialty);
CREATE INDEX IF NOT EXISTS idx_case_templates_difficulty ON public.case_templates(difficulty);

DROP TRIGGER IF EXISTS update_case_templates_updated_at ON public.case_templates;
CREATE TRIGGER update_case_templates_updated_at BEFORE UPDATE ON public.case_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Clinical Reasoning Engine tables created successfully! ✅' as status;
