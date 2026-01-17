-- Clinical Reasoning Engine Database Schema
-- Production-grade tables for clinical case management, OSCE simulations, and performance tracking
-- Run this in Supabase SQL Editor

-- ============================================================================
-- CLINICAL CASES TABLE
-- Stores structured patient cases with progressive information disclosure
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
  -- Structure: { age, sex, occupation, risk_factors[], ethnicity, social_background }
  
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

-- ============================================================================
-- CLINICAL REASONING STEPS TABLE
-- Tracks each step of user's reasoning process
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
  -- Structure: { score, feedback[], strengths[], improvements[], model_answer }
  
  score DECIMAL(5,2),
  
  -- Timing
  time_taken_seconds INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- OSCE SCENARIOS TABLE
-- Structured OSCE examination scenarios
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
  time_limit_seconds INTEGER NOT NULL DEFAULT 480, -- 8 minutes standard OSCE
  
  -- Patient Information
  patient_info JSONB NOT NULL DEFAULT '{}',
  -- Structure: { name, age, gender, presenting_complaint, background, appearance }
  
  -- Patient Script (for simulated responses)
  patient_script JSONB NOT NULL DEFAULT '{}',
  -- Structure: { opening_statement, responses: { question_type: response } }
  
  -- Examiner Configuration
  examiner_checklist JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{ item, points, category, critical }]
  
  expected_actions JSONB DEFAULT '[]',
  
  -- Interaction History
  interaction_history JSONB DEFAULT '[]',
  -- Structure: [{ timestamp, speaker, content, checklist_items_triggered[] }]
  
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

-- ============================================================================
-- CLINICAL PERFORMANCE TABLE
-- Aggregated performance metrics for each user
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
  -- Structure: { specialty: { cases_completed, avg_score, strongest_areas[], weakest_areas[] } }
  
  -- Cognitive Bias Tracking
  cognitive_biases_detected JSONB DEFAULT '[]',
  -- Structure: [{ bias_type, frequency, examples[], recommendations[] }]
  
  -- Skill Progression
  skill_progression JSONB DEFAULT '{}',
  -- Structure: { skill: [{ date, score }] }
  
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

-- ============================================================================
-- CLINICAL RUBRICS TABLE
-- Evaluation rubrics for scoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_rubrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Rubric Metadata
  rubric_name TEXT NOT NULL,
  rubric_type TEXT NOT NULL CHECK (rubric_type IN ('clinical_reasoning', 'osce', 'communication', 'procedure')),
  specialty TEXT,
  
  -- Scoring Criteria
  criteria JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{ name, description, max_score, weight, levels: [{ score, description }] }]
  
  -- Weighting
  total_weight DECIMAL(5,2) DEFAULT 100,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CASE TEMPLATES TABLE
-- Pre-built case templates for quick generation
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

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_clinical_cases_user_id ON public.clinical_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_clinical_cases_status ON public.clinical_cases(status);
CREATE INDEX IF NOT EXISTS idx_clinical_cases_specialty ON public.clinical_cases(specialty);
CREATE INDEX IF NOT EXISTS idx_clinical_cases_created_at ON public.clinical_cases(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reasoning_steps_case_id ON public.clinical_reasoning_steps(case_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_steps_user_id ON public.clinical_reasoning_steps(user_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_steps_step_type ON public.clinical_reasoning_steps(step_type);

CREATE INDEX IF NOT EXISTS idx_osce_scenarios_user_id ON public.osce_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_osce_scenarios_status ON public.osce_scenarios(status);
CREATE INDEX IF NOT EXISTS idx_osce_scenarios_type ON public.osce_scenarios(scenario_type);

CREATE INDEX IF NOT EXISTS idx_clinical_performance_user_id ON public.clinical_performance(user_id);

CREATE INDEX IF NOT EXISTS idx_case_templates_specialty ON public.case_templates(specialty);
CREATE INDEX IF NOT EXISTS idx_case_templates_difficulty ON public.case_templates(difficulty);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_clinical_cases_updated_at ON public.clinical_cases;
CREATE TRIGGER update_clinical_cases_updated_at BEFORE UPDATE ON public.clinical_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_osce_scenarios_updated_at ON public.osce_scenarios;
CREATE TRIGGER update_osce_scenarios_updated_at BEFORE UPDATE ON public.osce_scenarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clinical_performance_updated_at ON public.clinical_performance;
CREATE TRIGGER update_clinical_performance_updated_at BEFORE UPDATE ON public.clinical_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT DEFAULT RUBRICS
-- ============================================================================

INSERT INTO public.clinical_rubrics (rubric_name, rubric_type, criteria) VALUES
(
  'Clinical Reasoning Rubric',
  'clinical_reasoning',
  '[
    {"name": "Data Gathering", "description": "Systematic collection of relevant clinical information", "max_score": 5, "weight": 20, "levels": [
      {"score": 1, "description": "Minimal data gathering, missed critical information"},
      {"score": 2, "description": "Basic data gathering with significant gaps"},
      {"score": 3, "description": "Adequate data gathering, some gaps"},
      {"score": 4, "description": "Thorough data gathering with minor gaps"},
      {"score": 5, "description": "Comprehensive and systematic data gathering"}
    ]},
    {"name": "Problem Representation", "description": "Accurate synthesis of clinical findings", "max_score": 5, "weight": 20, "levels": [
      {"score": 1, "description": "Inaccurate or missing problem representation"},
      {"score": 2, "description": "Partial synthesis with major inaccuracies"},
      {"score": 3, "description": "Adequate synthesis with minor inaccuracies"},
      {"score": 4, "description": "Good synthesis capturing key elements"},
      {"score": 5, "description": "Excellent synthesis integrating all relevant findings"}
    ]},
    {"name": "Differential Diagnosis", "description": "Appropriate generation and prioritization of differentials", "max_score": 5, "weight": 25, "levels": [
      {"score": 1, "description": "Inappropriate or missing differentials"},
      {"score": 2, "description": "Limited differentials, poor prioritization"},
      {"score": 3, "description": "Reasonable differentials with some prioritization issues"},
      {"score": 4, "description": "Good differential list with appropriate prioritization"},
      {"score": 5, "description": "Comprehensive differentials with excellent reasoning"}
    ]},
    {"name": "Diagnostic Reasoning", "description": "Logical justification for diagnostic decisions", "max_score": 5, "weight": 20, "levels": [
      {"score": 1, "description": "No logical reasoning demonstrated"},
      {"score": 2, "description": "Weak reasoning with significant flaws"},
      {"score": 3, "description": "Adequate reasoning with minor gaps"},
      {"score": 4, "description": "Strong reasoning well-supported by evidence"},
      {"score": 5, "description": "Excellent reasoning demonstrating clinical expertise"}
    ]},
    {"name": "Management Planning", "description": "Appropriate and comprehensive management approach", "max_score": 5, "weight": 15, "levels": [
      {"score": 1, "description": "Inappropriate or dangerous management"},
      {"score": 2, "description": "Basic management with significant gaps"},
      {"score": 3, "description": "Adequate management plan"},
      {"score": 4, "description": "Good comprehensive management"},
      {"score": 5, "description": "Excellent evidence-based management plan"}
    ]}
  ]'
),
(
  'OSCE Communication Rubric',
  'osce',
  '[
    {"name": "Introduction & Rapport", "description": "Professional introduction and establishing rapport", "max_score": 5, "weight": 15, "levels": [
      {"score": 1, "description": "No introduction, poor rapport"},
      {"score": 2, "description": "Minimal introduction, limited rapport"},
      {"score": 3, "description": "Adequate introduction and rapport"},
      {"score": 4, "description": "Good professional introduction, effective rapport"},
      {"score": 5, "description": "Excellent introduction with outstanding rapport"}
    ]},
    {"name": "Communication Clarity", "description": "Clear, appropriate language for patient understanding", "max_score": 5, "weight": 20, "levels": [
      {"score": 1, "description": "Unclear communication, excessive jargon"},
      {"score": 2, "description": "Often unclear or inappropriate language"},
      {"score": 3, "description": "Generally clear communication"},
      {"score": 4, "description": "Clear and appropriate communication"},
      {"score": 5, "description": "Excellent clarity adapting to patient level"}
    ]},
    {"name": "Active Listening", "description": "Demonstrating attention and understanding", "max_score": 5, "weight": 15, "levels": [
      {"score": 1, "description": "No evidence of listening"},
      {"score": 2, "description": "Poor listening, frequent interruptions"},
      {"score": 3, "description": "Adequate listening"},
      {"score": 4, "description": "Good active listening with appropriate responses"},
      {"score": 5, "description": "Excellent listening with empathetic responses"}
    ]},
    {"name": "Clinical Competence", "description": "Appropriate clinical approach and knowledge", "max_score": 5, "weight": 30, "levels": [
      {"score": 1, "description": "Unsafe or inappropriate clinical approach"},
      {"score": 2, "description": "Basic approach with significant gaps"},
      {"score": 3, "description": "Adequate clinical competence"},
      {"score": 4, "description": "Good clinical competence and systematic approach"},
      {"score": 5, "description": "Excellent clinical expertise demonstrated"}
    ]},
    {"name": "Time Management", "description": "Efficient use of allocated time", "max_score": 5, "weight": 10, "levels": [
      {"score": 1, "description": "Severe time management issues"},
      {"score": 2, "description": "Poor time management"},
      {"score": 3, "description": "Adequate time management"},
      {"score": 4, "description": "Good time efficiency"},
      {"score": 5, "description": "Excellent time management"}
    ]},
    {"name": "Professionalism", "description": "Professional behavior and ethical conduct", "max_score": 5, "weight": 10, "levels": [
      {"score": 1, "description": "Unprofessional conduct"},
      {"score": 2, "description": "Lapses in professionalism"},
      {"score": 3, "description": "Adequate professionalism"},
      {"score": 4, "description": "Good professional behavior"},
      {"score": 5, "description": "Exemplary professionalism throughout"}
    ]}
  ]'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Clinical Reasoning tables created successfully!' as status;
