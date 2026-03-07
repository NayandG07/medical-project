-- ============================================================================
-- VAIDYA AI - COMPLETE DATABASE SCHEMA
-- Medical AI Platform - Supabase SQL Setup
-- Generated: 2026-01-16
-- ============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Run this ENTIRE file in Supabase SQL Editor
-- 2. Run in a SINGLE transaction for consistency
-- 3. This combines ALL tables from backend/database and backend/database/migrations
-- 4. Safe to run multiple times (uses IF NOT EXISTS)
--
-- ============================================================================


-- ============================================================================
-- SECTION 1: ENABLE REQUIRED EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- SECTION 2: CORE TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Users Table
-- Core user table for all platform users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'student', 'pro', 'admin')),
  role TEXT CHECK (role IN ('super_admin', 'admin', 'ops', 'support', 'viewer')),
  personal_api_key TEXT,
  fallback_locks JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled BOOLEAN NOT NULL DEFAULT FALSE
);

-- -----------------------------------------------------------------------------
-- Admin Allowlist Table
-- Controls which users have admin access
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'ops', 'support', 'viewer')),
  added_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Usage Counters Table
-- Tracks daily usage metrics per user
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  requests_count INTEGER NOT NULL DEFAULT 0,
  pdf_uploads INTEGER NOT NULL DEFAULT 0,
  mcqs_generated INTEGER NOT NULL DEFAULT 0,
  images_used INTEGER NOT NULL DEFAULT 0,
  flashcards_generated INTEGER NOT NULL DEFAULT 0,
  -- Per-feature document upload counters
  chat_uploads_per_day INTEGER NOT NULL DEFAULT 0,
  mcq_uploads_per_day INTEGER NOT NULL DEFAULT 0,
  flashcard_uploads_per_day INTEGER NOT NULL DEFAULT 0,
  explain_uploads_per_day INTEGER NOT NULL DEFAULT 0,
  highyield_uploads_per_day INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

-- -----------------------------------------------------------------------------
-- API Keys Table
-- Stores encrypted API keys for various providers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  feature TEXT NOT NULL,
  key_value TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'disabled')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Provider Health Table
-- Tracks health status of API providers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'failed')),
  response_time_ms INTEGER,
  error_message TEXT,
  quota_remaining INTEGER
);

-- -----------------------------------------------------------------------------
-- System Flags Table
-- Stores system-wide configuration flags
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_name TEXT UNIQUE NOT NULL,
  flag_value TEXT NOT NULL,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Audit Logs Table
-- Tracks all admin actions for compliance
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.users(id),
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 3: CHAT & MESSAGING TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Chat Sessions Table
-- Stores user chat sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Messages Table
-- Stores individual messages in chat sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  citations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 4: DOCUMENT & RAG TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Documents Table
-- Stores uploaded document metadata
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_progress INTEGER DEFAULT 0,
  processing_stage TEXT DEFAULT 'Pending',
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  feature TEXT CHECK (feature IN ('chat', 'mcq', 'flashcard', 'explain', 'highyield')),
  file_hash TEXT,
  total_chunks INTEGER DEFAULT 0,
  chunks_with_embeddings INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT documents_file_type_check CHECK (
      file_type IN (
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) OR file_type IS NULL
  )
);

-- -----------------------------------------------------------------------------
-- Document Chunks Table
-- Stores text chunks from documents for RAG
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(4096),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Embeddings Table (Legacy/Alternative)
-- Stores document embeddings (768-dimensional)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- RAG Usage Logs Table
-- Tracks RAG usage for monitoring and analytics
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rag_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('chat', 'mcq', 'flashcard', 'explain', 'highyield', 'unknown')),
  query_preview TEXT,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  results_count INTEGER DEFAULT 0,
  grounding_score FLOAT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 5: STUDY TOOLS TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Study Tool Sessions Table
-- Independent sessions for study tools (flashcards, MCQs, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_tool_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('flashcard', 'mcq', 'highyield', 'explain', 'map', 'conceptmap')),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Study Materials Table
-- Generated study materials linked to sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.study_tool_sessions(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('flashcard', 'mcq', 'highyield', 'explain', 'map', 'conceptmap')),
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Study Sessions Table (Basic Study Planner)
-- Basic study session scheduling
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  duration INTEGER NOT NULL,
  scheduled_date TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 6: ENHANCED STUDY PLANNER TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Study Plan Entries Table
-- Core table for storing individual study plan items
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Study Goals Table
-- Monthly/Weekly goals and milestones
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Performance Metrics Table
-- Track daily performance for analytics and AI recommendations
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- AI Recommendations Table
-- Store AI-generated study suggestions
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Study Streaks Table
-- Track user study streaks
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Study Templates Table
-- Reusable study plan templates
-- -----------------------------------------------------------------------------
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
-- SECTION 7: CLINICAL REASONING & OSCE TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Clinical Cases Table
-- Stores structured patient cases with progressive information disclosure
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Clinical Reasoning Steps Table
-- Tracks each step of user's reasoning process
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- OSCE Scenarios Table
-- Structured OSCE examination scenarios
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Clinical Performance Table
-- Aggregated performance metrics for each user
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Clinical Rubrics Table
-- Evaluation rubrics for scoring
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Case Templates Table
-- Pre-built case templates for quick generation
-- -----------------------------------------------------------------------------
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
-- SECTION 8: MEDICAL IMAGES & SESSIONS TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Medical Images Table
-- Stores medical images for AI-powered analysis and classification
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medical_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    format TEXT,
    category TEXT,
    image_type TEXT,
    body_region TEXT,
    analysis_status TEXT NOT NULL DEFAULT 'pending',
    analysis_text TEXT,
    findings TEXT[],
    clinical_impression TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ,
    CONSTRAINT valid_analysis_status CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed'))
);

CREATE OR REPLACE VIEW public.medical_image_stats AS
SELECT 
    user_id,
    COUNT(*) as total_images,
    COUNT(CASE WHEN analysis_status = 'completed' THEN 1 END) as analyzed_images,
    COUNT(CASE WHEN analysis_status = 'pending' THEN 1 END) as pending_images,
    COUNT(CASE WHEN analysis_status = 'failed' THEN 1 END) as failed_images,
    COUNT(DISTINCT category) as unique_categories,
    SUM(file_size) as total_storage_bytes,
    MAX(created_at) as last_upload_at
FROM public.medical_images
GROUP BY user_id;

-- -----------------------------------------------------------------------------
-- Image Analysis Sessions Table
-- Stores history of all image analyses with clinical context
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.image_analysis_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    image_filename TEXT NOT NULL,
    analysis_result JSONB NOT NULL,
    context TEXT,
    image_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- SECTION 9: SUBSCRIPTION & PAYMENT TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Subscriptions Table
-- User subscription management
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'student', 'pro', 'admin')),
  razorpay_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Payments Table
-- Payment transaction records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  razorpay_payment_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 9: MODEL USAGE LOGGING
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Model Usage Logs Table
-- Track all model API calls for monitoring, reporting, and cost analysis
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  feature TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  was_fallback BOOLEAN NOT NULL DEFAULT false,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  response_time_ms INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 10: CREATE ALL INDEXES
-- ============================================================================

-- Core tables indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_admin_allowlist_email ON public.admin_allowlist(email);
CREATE INDEX IF NOT EXISTS idx_usage_counters_user_date ON public.usage_counters(user_id, date);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider_feature ON public.api_keys(provider, feature);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON public.messages(session_id, created_at);

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_feature ON public.documents(feature);
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON public.documents(expires_at);
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON public.documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_user_feature ON public.documents(user_id, feature);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_users_fallback_locks ON public.users USING GIN (fallback_locks);

-- Medical images & sessions indexes
CREATE INDEX IF NOT EXISTS idx_medical_images_user_id ON public.medical_images(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_images_category ON public.medical_images(category);
CREATE INDEX IF NOT EXISTS idx_medical_images_analysis_status ON public.medical_images(analysis_status);
CREATE INDEX IF NOT EXISTS idx_medical_images_created_at ON public.medical_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_images_image_type ON public.medical_images(image_type);
CREATE INDEX IF NOT EXISTS idx_medical_images_body_region ON public.medical_images(body_region);
CREATE INDEX IF NOT EXISTS idx_medical_images_analysis_text ON public.medical_images USING gin(to_tsvector('english', COALESCE(analysis_text, '')));
CREATE INDEX IF NOT EXISTS idx_image_analysis_sessions_user_id ON public.image_analysis_sessions(user_id);

-- RAG indexes
CREATE INDEX IF NOT EXISTS idx_rag_logs_user_id ON public.rag_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_logs_feature ON public.rag_usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_rag_logs_timestamp ON public.rag_usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rag_logs_document_id ON public.rag_usage_logs(document_id);

-- Study tools indexes
CREATE INDEX IF NOT EXISTS idx_study_tool_sessions_user_id ON public.study_tool_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_tool_sessions_feature ON public.study_tool_sessions(feature);
CREATE INDEX IF NOT EXISTS idx_study_tool_sessions_created_at ON public.study_tool_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_tool_sessions_updated ON public.study_tool_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_tool_sessions_user_feature ON public.study_tool_sessions(user_id, feature);
CREATE INDEX IF NOT EXISTS idx_study_materials_session ON public.study_materials(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_study_materials_session_id ON public.study_materials(session_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_feature ON public.study_materials(feature);
CREATE INDEX IF NOT EXISTS idx_study_materials_created_at ON public.study_materials(created_at DESC);

-- Enhanced study planner indexes
CREATE INDEX IF NOT EXISTS idx_study_plan_entries_user_date ON public.study_plan_entries(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_study_plan_entries_status ON public.study_plan_entries(status);
CREATE INDEX IF NOT EXISTS idx_study_plan_entries_user_status ON public.study_plan_entries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_study_goals_user_id ON public.study_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_study_goals_active ON public.study_goals(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_date ON public.performance_metrics(user_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_pending ON public.ai_recommendations(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_study_streaks_user_id ON public.study_streaks(user_id);

-- Clinical reasoning indexes
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

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created ON public.audit_logs(admin_id, created_at DESC);

-- Model usage logs indexes
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_timestamp ON public.model_usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_user_id ON public.model_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_provider ON public.model_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_feature ON public.model_usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_success ON public.model_usage_logs(success);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_was_fallback ON public.model_usage_logs(was_fallback);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_key_id ON public.model_usage_logs(key_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_provider_feature ON public.model_usage_logs(provider, feature);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_timestamp_provider ON public.model_usage_logs(timestamp DESC, provider);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_timestamp_feature ON public.model_usage_logs(timestamp DESC, feature);

-- Vector similarity index for document chunks
-- Note: ivfflat index requires data to exist. Using HNSW for 4096 dims
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON public.document_chunks USING hnsw (embedding vector_cosine_ops);


-- ============================================================================
-- SECTION 11: CREATE FUNCTIONS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- updated_at Trigger Function
-- Automatically updates the updated_at column on row update
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Admin Check Function
-- Helper function to check if user is admin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist 
    WHERE email = (SELECT email FROM public.users WHERE id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Handle New User Function
-- Auto-sync trigger for new Supabase Auth users
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, plan, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        'free',
        NEW.created_at,
        NEW.updated_at
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Vector Similarity Search Function
-- RPC function for vector similarity search on document chunks
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding VECTOR(4096),
    match_count INT DEFAULT 5,
    filter_doc_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    chunk_index INTEGER,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        document_chunks.id,
        document_chunks.document_id,
        document_chunks.content,
        document_chunks.chunk_index,
        1 - (document_chunks.embedding <=> query_embedding) AS similarity
    FROM document_chunks
    WHERE 
        (filter_doc_ids IS NULL OR document_chunks.document_id = ANY(filter_doc_ids))
        AND document_chunks.embedding IS NOT NULL
    ORDER BY document_chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ============================================================================
-- SECTION 12: CREATE TRIGGERS
-- ============================================================================

-- Users table updated_at trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Chat sessions updated_at trigger
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Study tool sessions updated_at trigger
DROP TRIGGER IF EXISTS update_study_tool_sessions_updated_at ON public.study_tool_sessions;
CREATE TRIGGER update_study_tool_sessions_updated_at BEFORE UPDATE ON public.study_tool_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clinical cases updated_at trigger
DROP TRIGGER IF EXISTS update_clinical_cases_updated_at ON public.clinical_cases;
CREATE TRIGGER update_clinical_cases_updated_at BEFORE UPDATE ON public.clinical_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- OSCE scenarios updated_at trigger
DROP TRIGGER IF EXISTS update_osce_scenarios_updated_at ON public.osce_scenarios;
CREATE TRIGGER update_osce_scenarios_updated_at BEFORE UPDATE ON public.osce_scenarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clinical performance updated_at trigger
DROP TRIGGER IF EXISTS update_clinical_performance_updated_at ON public.clinical_performance;
CREATE TRIGGER update_clinical_performance_updated_at BEFORE UPDATE ON public.clinical_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clinical rubrics updated_at trigger
DROP TRIGGER IF EXISTS update_clinical_rubrics_updated_at ON public.clinical_rubrics;
CREATE TRIGGER update_clinical_rubrics_updated_at BEFORE UPDATE ON public.clinical_rubrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Case templates updated_at trigger
DROP TRIGGER IF EXISTS update_case_templates_updated_at ON public.case_templates;
CREATE TRIGGER update_case_templates_updated_at BEFORE UPDATE ON public.case_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Study plan entries updated_at trigger
DROP TRIGGER IF EXISTS update_study_plan_entries_updated_at ON public.study_plan_entries;
CREATE TRIGGER update_study_plan_entries_updated_at BEFORE UPDATE ON public.study_plan_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Study goals updated_at trigger
DROP TRIGGER IF EXISTS update_study_goals_updated_at ON public.study_goals;
CREATE TRIGGER update_study_goals_updated_at BEFORE UPDATE ON public.study_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Performance metrics updated_at trigger
DROP TRIGGER IF EXISTS update_performance_metrics_updated_at ON public.performance_metrics;
CREATE TRIGGER update_performance_metrics_updated_at BEFORE UPDATE ON public.performance_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Study streaks updated_at trigger
DROP TRIGGER IF EXISTS update_study_streaks_updated_at ON public.study_streaks;
CREATE TRIGGER update_study_streaks_updated_at BEFORE UPDATE ON public.study_streaks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Study sessions updated_at trigger
DROP TRIGGER IF EXISTS update_study_sessions_updated_at ON public.study_sessions;
CREATE TRIGGER update_study_sessions_updated_at BEFORE UPDATE ON public.study_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Subscriptions updated_at trigger
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Study templates updated_at trigger
DROP TRIGGER IF EXISTS update_study_templates_updated_at ON public.study_templates;
CREATE TRIGGER update_study_templates_updated_at BEFORE UPDATE ON public.study_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Documents updated_at trigger
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- API Keys updated_at trigger
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Image Analysis Sessions updated_at trigger
DROP TRIGGER IF EXISTS update_image_analysis_sessions_updated_at ON public.image_analysis_sessions;
CREATE TRIGGER update_image_analysis_sessions_updated_at BEFORE UPDATE ON public.image_analysis_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auth user sync trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- SECTION 13: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tool_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_reasoning_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osce_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_analysis_sessions ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- SECTION 14: RLS POLICIES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Users Table Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users FOR SELECT USING (is_admin());

-- -----------------------------------------------------------------------------
-- Chat Sessions Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS chat_sessions_select_own ON public.chat_sessions;
CREATE POLICY chat_sessions_select_own ON public.chat_sessions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS chat_sessions_insert_own ON public.chat_sessions;
CREATE POLICY chat_sessions_insert_own ON public.chat_sessions FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_sessions_update_own ON public.chat_sessions;
CREATE POLICY chat_sessions_update_own ON public.chat_sessions FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS chat_sessions_delete_own ON public.chat_sessions;
CREATE POLICY chat_sessions_delete_own ON public.chat_sessions FOR DELETE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Messages Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_select_own ON public.messages;
CREATE POLICY messages_select_own ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_sessions WHERE chat_sessions.id = messages.session_id AND chat_sessions.user_id = auth.uid())
);

DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.chat_sessions WHERE chat_sessions.id = messages.session_id AND chat_sessions.user_id = auth.uid())
);

-- -----------------------------------------------------------------------------
-- Documents Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
CREATE POLICY "Users can insert own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Document Chunks Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view chunks of own documents" ON public.document_chunks;
CREATE POLICY "Users can view chunks of own documents" ON public.document_chunks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid())
);

DROP POLICY IF EXISTS "System can insert chunks" ON public.document_chunks;
CREATE POLICY "System can insert chunks" ON public.document_chunks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can delete chunks" ON public.document_chunks;
CREATE POLICY "System can delete chunks" ON public.document_chunks FOR DELETE USING (true);

-- -----------------------------------------------------------------------------
-- Study Tool Sessions Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS study_tool_sessions_select_policy ON public.study_tool_sessions;
CREATE POLICY study_tool_sessions_select_policy ON public.study_tool_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS study_tool_sessions_insert_policy ON public.study_tool_sessions;
CREATE POLICY study_tool_sessions_insert_policy ON public.study_tool_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS study_tool_sessions_update_policy ON public.study_tool_sessions;
CREATE POLICY study_tool_sessions_update_policy ON public.study_tool_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS study_tool_sessions_delete_policy ON public.study_tool_sessions;
CREATE POLICY study_tool_sessions_delete_policy ON public.study_tool_sessions FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Study Materials Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS study_tool_materials_select_policy ON public.study_materials;
CREATE POLICY study_tool_materials_select_policy ON public.study_materials FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.study_tool_sessions WHERE study_tool_sessions.id = study_materials.session_id AND study_tool_sessions.user_id = auth.uid())
);

DROP POLICY IF EXISTS study_tool_materials_insert_policy ON public.study_materials;
CREATE POLICY study_tool_materials_insert_policy ON public.study_materials FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.study_tool_sessions WHERE study_tool_sessions.id = study_materials.session_id AND study_tool_sessions.user_id = auth.uid())
);

DROP POLICY IF EXISTS study_tool_materials_delete_policy ON public.study_materials;
CREATE POLICY study_tool_materials_delete_policy ON public.study_materials FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.study_tool_sessions WHERE study_tool_sessions.id = study_materials.session_id AND study_tool_sessions.user_id = auth.uid())
);

-- -----------------------------------------------------------------------------
-- Usage Counters Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS usage_counters_select_own ON public.usage_counters;
CREATE POLICY usage_counters_select_own ON public.usage_counters FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS usage_counters_insert_own ON public.usage_counters;
CREATE POLICY usage_counters_insert_own ON public.usage_counters FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS usage_counters_update_own ON public.usage_counters;
CREATE POLICY usage_counters_update_own ON public.usage_counters FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS usage_counters_admin ON public.usage_counters;
CREATE POLICY usage_counters_admin ON public.usage_counters FOR ALL USING (is_admin());

-- -----------------------------------------------------------------------------
-- Study Sessions Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS study_sessions_select_own ON public.study_sessions;
CREATE POLICY study_sessions_select_own ON public.study_sessions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS study_sessions_insert_own ON public.study_sessions;
CREATE POLICY study_sessions_insert_own ON public.study_sessions FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS study_sessions_update_own ON public.study_sessions;
CREATE POLICY study_sessions_update_own ON public.study_sessions FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS study_sessions_delete_own ON public.study_sessions;
CREATE POLICY study_sessions_delete_own ON public.study_sessions FOR DELETE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Study Plan Entries Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS study_plan_entries_select_own ON public.study_plan_entries;
CREATE POLICY study_plan_entries_select_own ON public.study_plan_entries FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS study_plan_entries_insert_own ON public.study_plan_entries;
CREATE POLICY study_plan_entries_insert_own ON public.study_plan_entries FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS study_plan_entries_update_own ON public.study_plan_entries;
CREATE POLICY study_plan_entries_update_own ON public.study_plan_entries FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS study_plan_entries_delete_own ON public.study_plan_entries;
CREATE POLICY study_plan_entries_delete_own ON public.study_plan_entries FOR DELETE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Study Goals Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS study_goals_select_own ON public.study_goals;
CREATE POLICY study_goals_select_own ON public.study_goals FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS study_goals_insert_own ON public.study_goals;
CREATE POLICY study_goals_insert_own ON public.study_goals FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS study_goals_update_own ON public.study_goals;
CREATE POLICY study_goals_update_own ON public.study_goals FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS study_goals_delete_own ON public.study_goals;
CREATE POLICY study_goals_delete_own ON public.study_goals FOR DELETE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Performance Metrics Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS performance_metrics_select_own ON public.performance_metrics;
CREATE POLICY performance_metrics_select_own ON public.performance_metrics FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS performance_metrics_insert_own ON public.performance_metrics;
CREATE POLICY performance_metrics_insert_own ON public.performance_metrics FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS performance_metrics_update_own ON public.performance_metrics;
CREATE POLICY performance_metrics_update_own ON public.performance_metrics FOR UPDATE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- AI Recommendations Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS ai_recommendations_select_own ON public.ai_recommendations;
CREATE POLICY ai_recommendations_select_own ON public.ai_recommendations FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_recommendations_update_own ON public.ai_recommendations;
CREATE POLICY ai_recommendations_update_own ON public.ai_recommendations FOR UPDATE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Study Streaks Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS study_streaks_select_own ON public.study_streaks;
CREATE POLICY study_streaks_select_own ON public.study_streaks FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS study_streaks_insert_own ON public.study_streaks;
CREATE POLICY study_streaks_insert_own ON public.study_streaks FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS study_streaks_update_own ON public.study_streaks;
CREATE POLICY study_streaks_update_own ON public.study_streaks FOR UPDATE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Study Templates Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS study_templates_select ON public.study_templates;
CREATE POLICY study_templates_select ON public.study_templates FOR SELECT USING (
  user_id = auth.uid() OR is_public = true
);

DROP POLICY IF EXISTS study_templates_insert_own ON public.study_templates;
CREATE POLICY study_templates_insert_own ON public.study_templates FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS study_templates_update_own ON public.study_templates;
CREATE POLICY study_templates_update_own ON public.study_templates FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS study_templates_delete_own ON public.study_templates;
CREATE POLICY study_templates_delete_own ON public.study_templates FOR DELETE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Clinical Cases Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS clinical_cases_select_own ON public.clinical_cases;
CREATE POLICY clinical_cases_select_own ON public.clinical_cases FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_cases_insert_own ON public.clinical_cases;
CREATE POLICY clinical_cases_insert_own ON public.clinical_cases FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_cases_update_own ON public.clinical_cases;
CREATE POLICY clinical_cases_update_own ON public.clinical_cases FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_cases_delete_own ON public.clinical_cases;
CREATE POLICY clinical_cases_delete_own ON public.clinical_cases FOR DELETE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Clinical Reasoning Steps Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS clinical_reasoning_steps_select_own ON public.clinical_reasoning_steps;
CREATE POLICY clinical_reasoning_steps_select_own ON public.clinical_reasoning_steps FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_reasoning_steps_insert_own ON public.clinical_reasoning_steps;
CREATE POLICY clinical_reasoning_steps_insert_own ON public.clinical_reasoning_steps FOR INSERT WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- OSCE Scenarios Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS osce_scenarios_select_own ON public.osce_scenarios;
CREATE POLICY osce_scenarios_select_own ON public.osce_scenarios FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS osce_scenarios_insert_own ON public.osce_scenarios;
CREATE POLICY osce_scenarios_insert_own ON public.osce_scenarios FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS osce_scenarios_update_own ON public.osce_scenarios;
CREATE POLICY osce_scenarios_update_own ON public.osce_scenarios FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS osce_scenarios_delete_own ON public.osce_scenarios;
CREATE POLICY osce_scenarios_delete_own ON public.osce_scenarios FOR DELETE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Clinical Performance Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS clinical_performance_select_own ON public.clinical_performance;
CREATE POLICY clinical_performance_select_own ON public.clinical_performance FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_performance_insert_own ON public.clinical_performance;
CREATE POLICY clinical_performance_insert_own ON public.clinical_performance FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS clinical_performance_update_own ON public.clinical_performance;
CREATE POLICY clinical_performance_update_own ON public.clinical_performance FOR UPDATE USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Subscriptions Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_admin ON public.subscriptions;
CREATE POLICY subscriptions_admin ON public.subscriptions FOR ALL USING (is_admin());

-- -----------------------------------------------------------------------------
-- Payments Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS payments_admin ON public.payments;
CREATE POLICY payments_admin ON public.payments FOR ALL USING (is_admin());

-- -----------------------------------------------------------------------------
-- RAG Usage Logs Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS rag_usage_logs_select_own ON public.rag_usage_logs;
CREATE POLICY rag_usage_logs_select_own ON public.rag_usage_logs FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS rag_usage_logs_admin ON public.rag_usage_logs;
CREATE POLICY rag_usage_logs_admin ON public.rag_usage_logs FOR ALL USING (is_admin());

-- -----------------------------------------------------------------------------
-- System Flags & Provider Health Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS system_flags_select_all ON public.system_flags;
CREATE POLICY system_flags_select_all ON public.system_flags FOR SELECT USING (true);

DROP POLICY IF EXISTS system_flags_modify_admin ON public.system_flags;
CREATE POLICY system_flags_modify_admin ON public.system_flags FOR ALL USING (is_admin());

DROP POLICY IF EXISTS provider_health_admin ON public.provider_health;
CREATE POLICY provider_health_admin ON public.provider_health FOR ALL USING (is_admin());

-- -----------------------------------------------------------------------------
-- Embeddings Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS embeddings_select_own ON public.embeddings;
CREATE POLICY embeddings_select_own ON public.embeddings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.documents WHERE documents.id = embeddings.document_id AND documents.user_id = auth.uid())
);

-- -----------------------------------------------------------------------------
-- Admin-only Tables Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS api_keys_admin ON public.api_keys;
CREATE POLICY api_keys_admin ON public.api_keys FOR ALL USING (is_admin());

DROP POLICY IF EXISTS admin_allowlist_admin ON public.admin_allowlist;
CREATE POLICY admin_allowlist_admin ON public.admin_allowlist FOR ALL USING (is_admin());

DROP POLICY IF EXISTS audit_logs_insert_admin ON public.audit_logs;
CREATE POLICY audit_logs_insert_admin ON public.audit_logs FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs FOR SELECT USING (is_admin());

-- -----------------------------------------------------------------------------
-- Medical Images & Sessions Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own medical images" ON public.medical_images;
CREATE POLICY "Users can view their own medical images" ON public.medical_images FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own medical images" ON public.medical_images;
CREATE POLICY "Users can insert their own medical images" ON public.medical_images FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own medical images" ON public.medical_images;
CREATE POLICY "Users can update their own medical images" ON public.medical_images FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own medical images" ON public.medical_images;
CREATE POLICY "Users can delete their own medical images" ON public.medical_images FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own sessions" ON public.image_analysis_sessions;
CREATE POLICY "Users can view their own sessions" ON public.image_analysis_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.image_analysis_sessions;
CREATE POLICY "Users can insert their own sessions" ON public.image_analysis_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.image_analysis_sessions;
CREATE POLICY "Users can update their own sessions" ON public.image_analysis_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.image_analysis_sessions;
CREATE POLICY "Users can delete their own sessions" ON public.image_analysis_sessions FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Model Usage Logs Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all model usage logs" ON public.model_usage_logs;
CREATE POLICY "Admins can view all model usage logs" ON public.model_usage_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'admin'))
);

DROP POLICY IF EXISTS "Users can view their own model usage logs" ON public.model_usage_logs;
CREATE POLICY "Users can view their own model usage logs" ON public.model_usage_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can insert model usage logs" ON public.model_usage_logs;
CREATE POLICY "Service role can insert model usage logs" ON public.model_usage_logs FOR INSERT WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Service Role Bypass Policies (for backend operations)
-- These allow the service role to perform operations on behalf of users
-- -----------------------------------------------------------------------------
-- Note: Service role (SUPABASE_SERVICE_KEY) bypasses RLS by default
-- These policies are for additional safety when using user tokens with elevated privileges


-- ============================================================================
-- SECTION 15: INSERT DEFAULT DATA
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Default Clinical Rubrics
-- -----------------------------------------------------------------------------
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
-- SECTION 16: ADD TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.users IS 'Core user table for all platform users';
COMMENT ON TABLE public.admin_allowlist IS 'Controls which users have admin access';
COMMENT ON TABLE public.usage_counters IS 'Tracks daily usage metrics per user';
COMMENT ON TABLE public.api_keys IS 'Stores encrypted API keys for various providers';
COMMENT ON TABLE public.provider_health IS 'Tracks health status of API providers';
COMMENT ON TABLE public.system_flags IS 'Stores system-wide configuration flags';
COMMENT ON TABLE public.audit_logs IS 'Tracks all admin actions for compliance';
COMMENT ON TABLE public.chat_sessions IS 'Stores user chat sessions';
COMMENT ON TABLE public.messages IS 'Stores individual messages in chat sessions';
COMMENT ON TABLE public.documents IS 'Stores uploaded document metadata';
COMMENT ON TABLE public.document_chunks IS 'Stores text chunks from documents for RAG';
COMMENT ON TABLE public.embeddings IS 'Stores document embeddings for vector search';
COMMENT ON TABLE public.rag_usage_logs IS 'Tracks RAG usage for monitoring and analytics';
COMMENT ON TABLE public.study_tool_sessions IS 'Independent sessions for study tools (flashcards, MCQs, etc.)';
COMMENT ON TABLE public.study_materials IS 'Generated study materials linked to sessions';
COMMENT ON TABLE public.study_sessions IS 'Basic study session scheduling';
COMMENT ON TABLE public.study_plan_entries IS 'Core table for storing individual study plan items';
COMMENT ON TABLE public.study_goals IS 'Monthly/Weekly goals and milestones';
COMMENT ON TABLE public.performance_metrics IS 'Track daily performance for analytics and AI recommendations';
COMMENT ON TABLE public.ai_recommendations IS 'Store AI-generated study suggestions';
COMMENT ON TABLE public.study_streaks IS 'Track user study streaks';
COMMENT ON TABLE public.study_templates IS 'Reusable study plan templates';
COMMENT ON TABLE public.clinical_cases IS 'Stores structured patient cases with progressive information disclosure';
COMMENT ON TABLE public.clinical_reasoning_steps IS 'Tracks each step of users reasoning process';
COMMENT ON TABLE public.osce_scenarios IS 'Structured OSCE examination scenarios';
COMMENT ON TABLE public.clinical_performance IS 'Aggregated performance metrics for each user';
COMMENT ON TABLE public.clinical_rubrics IS 'Evaluation rubrics for scoring';
COMMENT ON TABLE public.case_templates IS 'Pre-built case templates for quick generation';
COMMENT ON TABLE public.subscriptions IS 'User subscription management';
COMMENT ON TABLE public.payments IS 'Payment transaction records';
COMMENT ON TABLE public.model_usage_logs IS 'Logs all model API calls for monitoring and cost tracking';

COMMENT ON COLUMN public.usage_counters.chat_uploads_per_day IS 'Number of documents uploaded for chat feature today';
COMMENT ON COLUMN public.usage_counters.mcq_uploads_per_day IS 'Number of documents uploaded for MCQ feature today';
COMMENT ON COLUMN public.usage_counters.flashcard_uploads_per_day IS 'Number of documents uploaded for flashcard feature today';
COMMENT ON COLUMN public.usage_counters.explain_uploads_per_day IS 'Number of documents uploaded for explain feature today';
COMMENT ON COLUMN public.usage_counters.highyield_uploads_per_day IS 'Number of documents uploaded for high yield feature today';
COMMENT ON COLUMN public.rag_usage_logs.grounding_score IS 'Score indicating how well the response was grounded in document context (0-1)';
COMMENT ON COLUMN public.model_usage_logs.provider IS 'Provider name (openrouter, huggingface, etc.)';
COMMENT ON COLUMN public.model_usage_logs.model IS 'Specific model used (e.g., claude-sonnet-4.5, meditron-7b)';
COMMENT ON COLUMN public.model_usage_logs.feature IS 'Feature that triggered the call (chat, flashcard, etc.)';
COMMENT ON COLUMN public.model_usage_logs.was_fallback IS 'True if this was a fallback attempt after primary key failed';
COMMENT ON COLUMN public.model_usage_logs.attempt_number IS 'Attempt number in the fallback chain (1 = first try)';
COMMENT ON COLUMN public.model_usage_logs.key_id IS 'API key ID that was used for this call';

COMMENT ON FUNCTION match_document_chunks IS 'Vector similarity search for document chunks using cosine distance';


-- ============================================================================
-- SECTION 17: VERIFICATION
-- ============================================================================

-- Show all created tables
SELECT 
  'Tables created successfully!' as status,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count;

-- ============================================================================
-- COMPLETE DATABASE SCHEMA - END
-- ============================================================================
