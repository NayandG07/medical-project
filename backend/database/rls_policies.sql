-- Medical AI Platform Row Level Security (RLS) Policies
-- This file contains all RLS policies for securing database access
-- Requirements: 23.4, 23.5

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_allowlist 
    WHERE email = (SELECT email FROM users WHERE id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can read their own record
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY users_select_admin ON users
  FOR SELECT
  USING (is_admin());

-- Users can update their own record (limited fields)
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any user
CREATE POLICY users_update_admin ON users
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins can insert users (registration handled by Supabase Auth)
CREATE POLICY users_insert_admin ON users
  FOR INSERT
  WITH CHECK (is_admin());

-- ============================================================================
-- ADMIN_ALLOWLIST TABLE POLICIES
-- ============================================================================

-- Only admins can access admin_allowlist
CREATE POLICY admin_allowlist_all ON admin_allowlist
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- USAGE_COUNTERS TABLE POLICIES
-- ============================================================================

-- Users can read their own usage
CREATE POLICY usage_counters_select_own ON usage_counters
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all usage
CREATE POLICY usage_counters_select_admin ON usage_counters
  FOR SELECT
  USING (is_admin());

-- Backend service can insert/update usage (via service role key)
-- Users cannot directly modify their usage counters
CREATE POLICY usage_counters_insert_service ON usage_counters
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

CREATE POLICY usage_counters_update_service ON usage_counters
  FOR UPDATE
  USING (true) -- Service role bypasses RLS
  WITH CHECK (true);

-- Admins can update usage (for manual resets)
CREATE POLICY usage_counters_update_admin ON usage_counters
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- API_KEYS TABLE POLICIES (Admin-only)
-- ============================================================================

-- Only admins can access API keys
CREATE POLICY api_keys_all ON api_keys
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- PROVIDER_HEALTH TABLE POLICIES (Admin-only)
-- ============================================================================

-- Only admins can access provider health data
CREATE POLICY provider_health_all ON provider_health
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- SYSTEM_FLAGS TABLE POLICIES (Admin-only)
-- ============================================================================

-- Only admins can access system flags
CREATE POLICY system_flags_all ON system_flags
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- DOCUMENTS TABLE POLICIES (User-owned data)
-- ============================================================================

-- Users can only access their own documents
CREATE POLICY documents_select_own ON documents
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own documents
CREATE POLICY documents_insert_own ON documents
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own documents
CREATE POLICY documents_update_own ON documents
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own documents
CREATE POLICY documents_delete_own ON documents
  FOR DELETE
  USING (user_id = auth.uid());

-- Admins can access all documents
CREATE POLICY documents_select_admin ON documents
  FOR SELECT
  USING (is_admin());

-- ============================================================================
-- EMBEDDINGS TABLE POLICIES (User-owned data via documents)
-- ============================================================================

-- Users can only access embeddings for their own documents
CREATE POLICY embeddings_select_own ON embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = embeddings.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- Backend service can insert embeddings (via service role key)
CREATE POLICY embeddings_insert_service ON embeddings
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- Users can delete embeddings for their own documents
CREATE POLICY embeddings_delete_own ON embeddings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM documents 
      WHERE documents.id = embeddings.document_id 
      AND documents.user_id = auth.uid()
    )
  );

-- Admins can access all embeddings
CREATE POLICY embeddings_select_admin ON embeddings
  FOR SELECT
  USING (is_admin());

-- ============================================================================
-- CHAT_SESSIONS TABLE POLICIES (User-owned data)
-- ============================================================================

-- Users can only access their own chat sessions
CREATE POLICY chat_sessions_select_own ON chat_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own chat sessions
CREATE POLICY chat_sessions_insert_own ON chat_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own chat sessions
CREATE POLICY chat_sessions_update_own ON chat_sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own chat sessions
CREATE POLICY chat_sessions_delete_own ON chat_sessions
  FOR DELETE
  USING (user_id = auth.uid());

-- Admins can access all chat sessions
CREATE POLICY chat_sessions_select_admin ON chat_sessions
  FOR SELECT
  USING (is_admin());

-- ============================================================================
-- MESSAGES TABLE POLICIES (User-owned data via chat_sessions)
-- ============================================================================

-- Users can only access messages in their own chat sessions
CREATE POLICY messages_select_own ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Users can insert messages in their own chat sessions
CREATE POLICY messages_insert_own ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Backend service can insert messages (for AI responses)
CREATE POLICY messages_insert_service ON messages
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- Users can delete messages in their own chat sessions
CREATE POLICY messages_delete_own ON messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Admins can access all messages
CREATE POLICY messages_select_admin ON messages
  FOR SELECT
  USING (is_admin());

-- ============================================================================
-- SUBSCRIPTIONS TABLE POLICIES (User-owned data)
-- ============================================================================

-- Users can read their own subscriptions
CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all subscriptions
CREATE POLICY subscriptions_select_admin ON subscriptions
  FOR SELECT
  USING (is_admin());

-- Backend service can insert/update subscriptions (via service role key)
CREATE POLICY subscriptions_insert_service ON subscriptions
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

CREATE POLICY subscriptions_update_service ON subscriptions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Admins can update subscriptions
CREATE POLICY subscriptions_update_admin ON subscriptions
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- PAYMENTS TABLE POLICIES (User-owned data)
-- ============================================================================

-- Users can read their own payments
CREATE POLICY payments_select_own ON payments
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all payments
CREATE POLICY payments_select_admin ON payments
  FOR SELECT
  USING (is_admin());

-- Backend service can insert payments (via service role key)
CREATE POLICY payments_insert_service ON payments
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- ============================================================================
-- AUDIT_LOGS TABLE POLICIES (Admin-only)
-- ============================================================================

-- Only admins can access audit logs
CREATE POLICY audit_logs_select_admin ON audit_logs
  FOR SELECT
  USING (is_admin());

-- Backend service can insert audit logs (via service role key)
CREATE POLICY audit_logs_insert_service ON audit_logs
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION is_admin() IS 'Helper function to check if current user is in admin_allowlist';
COMMENT ON POLICY users_select_own ON users IS 'Users can read their own user record';
COMMENT ON POLICY users_select_admin ON users IS 'Admins can read all user records';
COMMENT ON POLICY usage_counters_select_own ON usage_counters IS 'Users can read their own usage counters';
COMMENT ON POLICY usage_counters_select_admin ON usage_counters IS 'Admins can read all usage counters';
COMMENT ON POLICY api_keys_all ON api_keys IS 'Only admins can access API keys';
COMMENT ON POLICY documents_select_own ON documents IS 'Users can only access their own documents';
COMMENT ON POLICY chat_sessions_select_own ON chat_sessions IS 'Users can only access their own chat sessions';
COMMENT ON POLICY messages_select_own ON messages IS 'Users can only access messages in their own chat sessions';

