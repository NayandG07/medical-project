-- Medical AI Platform Database Schema
-- This file contains all table definitions for the Supabase database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- ============================================================================
-- USERS AND AUTHENTICATION
-- ============================================================================

-- Users table with plan and role fields
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'student', 'pro', 'admin')),
  role TEXT CHECK (role IN ('super_admin', 'admin', 'ops', 'support', 'viewer')),
  personal_api_key TEXT, -- encrypted, optional user-supplied key
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Admin allowlist table
CREATE TABLE IF NOT EXISTS admin_allowlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'ops', 'support', 'viewer')),
  added_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for faster admin checks
CREATE INDEX IF NOT EXISTS idx_admin_allowlist_email ON admin_allowlist(email);

-- ============================================================================
-- USAGE TRACKING AND RATE LIMITING
-- ============================================================================

-- Usage counters table with daily tracking fields
CREATE TABLE IF NOT EXISTS usage_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  requests_count INTEGER NOT NULL DEFAULT 0,
  pdf_uploads INTEGER NOT NULL DEFAULT 0,
  mcqs_generated INTEGER NOT NULL DEFAULT 0,
  images_used INTEGER NOT NULL DEFAULT 0,
  flashcards_generated INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Create indexes for faster usage lookups
CREATE INDEX IF NOT EXISTS idx_usage_counters_user_date ON usage_counters(user_id, date);

-- ============================================================================
-- API KEY POOL MANAGEMENT
-- ============================================================================

-- API keys table with encryption support
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL, -- gemini, openai, ollama, etc.
  feature TEXT NOT NULL, -- chat, flashcard, mcq, image, etc.
  key_value TEXT NOT NULL, -- encrypted API key
  priority INTEGER NOT NULL DEFAULT 0, -- higher = preferred
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'disabled')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster key selection
CREATE INDEX IF NOT EXISTS idx_api_keys_provider_feature ON api_keys(provider, feature);
CREATE INDEX IF NOT EXISTS idx_api_keys_status_priority ON api_keys(status, priority DESC);

-- ============================================================================
-- PROVIDER HEALTH MONITORING
-- ============================================================================

-- Provider health table
CREATE TABLE IF NOT EXISTS provider_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'failed')),
  response_time_ms INTEGER,
  error_message TEXT,
  quota_remaining INTEGER
);

-- Create index for faster health status lookups
CREATE INDEX IF NOT EXISTS idx_provider_health_key_checked ON provider_health(api_key_id, checked_at DESC);

-- ============================================================================
-- SYSTEM CONFIGURATION
-- ============================================================================

-- System flags table for feature toggles and maintenance mode
CREATE TABLE IF NOT EXISTS system_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_name TEXT UNIQUE NOT NULL, -- maintenance_mode, feature_chat_enabled, etc.
  flag_value TEXT NOT NULL, -- JSON or simple value
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on flag_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_flags_name ON system_flags(flag_name);

-- ============================================================================
-- DOCUMENT MANAGEMENT AND RAG
-- ============================================================================

-- Documents table for PDF and image uploads
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image')),
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster user document lookups
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);

-- Embeddings table with pgvector support
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding VECTOR(768), -- dimension depends on embedding model
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_document ON embeddings(document_id);

-- ============================================================================
-- CHAT AND MESSAGING
-- ============================================================================

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster user session lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  citations JSONB, -- for RAG responses with document citations
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);

-- ============================================================================
-- PAYMENTS AND SUBSCRIPTIONS
-- ============================================================================

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'student', 'pro', 'admin')),
  razorpay_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_id ON subscriptions(razorpay_subscription_id);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  razorpay_payment_id TEXT UNIQUE,
  amount INTEGER NOT NULL, -- in paise (smallest currency unit)
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_id ON payments(razorpay_payment_id);

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

-- Audit logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL, -- add_key, change_plan, toggle_feature, etc.
  target_type TEXT, -- user, api_key, feature, etc.
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created ON audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_flags_updated_at BEFORE UPDATE ON system_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts with plan and role information';
COMMENT ON TABLE admin_allowlist IS 'Whitelist of admin users with their roles';
COMMENT ON TABLE usage_counters IS 'Daily usage tracking per user for rate limiting';
COMMENT ON TABLE api_keys IS 'Pool of API keys for external providers with priority and health status';
COMMENT ON TABLE provider_health IS 'Health check history for API keys';
COMMENT ON TABLE system_flags IS 'System-wide configuration flags for features and maintenance';
COMMENT ON TABLE documents IS 'User-uploaded documents (PDFs and images)';
COMMENT ON TABLE embeddings IS 'Vector embeddings for RAG functionality';
COMMENT ON TABLE chat_sessions IS 'Chat conversation sessions';
COMMENT ON TABLE messages IS 'Individual messages within chat sessions';
COMMENT ON TABLE subscriptions IS 'User subscription records';
COMMENT ON TABLE payments IS 'Payment transaction records';
COMMENT ON TABLE audit_logs IS 'Audit trail of admin actions';
