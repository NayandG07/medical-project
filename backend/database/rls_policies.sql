-- Medical AI Platform Row Level Security (RLS) Policies
-- Run this AFTER schema.sql (optional - backend uses service_role which bypasses RLS)

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper function to check if user is admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist 
    WHERE email = (SELECT email FROM public.users WHERE id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Users table policies
-- ============================================================================

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users FOR SELECT USING (is_admin());

-- ============================================================================
-- Chat sessions policies
-- ============================================================================

DROP POLICY IF EXISTS chat_sessions_select_own ON public.chat_sessions;
CREATE POLICY chat_sessions_select_own ON public.chat_sessions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS chat_sessions_insert_own ON public.chat_sessions;
CREATE POLICY chat_sessions_insert_own ON public.chat_sessions FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_sessions_update_own ON public.chat_sessions;
CREATE POLICY chat_sessions_update_own ON public.chat_sessions FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS chat_sessions_delete_own ON public.chat_sessions;
CREATE POLICY chat_sessions_delete_own ON public.chat_sessions FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- Messages policies
-- ============================================================================

DROP POLICY IF EXISTS messages_select_own ON public.messages;
CREATE POLICY messages_select_own ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_sessions WHERE chat_sessions.id = messages.session_id AND chat_sessions.user_id = auth.uid())
);

DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.chat_sessions WHERE chat_sessions.id = messages.session_id AND chat_sessions.user_id = auth.uid())
);

-- ============================================================================
-- Admin-only tables (api_keys, admin_allowlist, audit_logs, etc.)
-- ============================================================================

DROP POLICY IF EXISTS api_keys_admin ON public.api_keys;
CREATE POLICY api_keys_admin ON public.api_keys FOR ALL USING (is_admin());

DROP POLICY IF EXISTS admin_allowlist_admin ON public.admin_allowlist;
CREATE POLICY admin_allowlist_admin ON public.admin_allowlist FOR ALL USING (is_admin());

DROP POLICY IF EXISTS audit_logs_admin ON public.audit_logs;
CREATE POLICY audit_logs_admin ON public.audit_logs FOR SELECT USING (is_admin());

-- ============================================================================
-- DONE!
-- ============================================================================

SELECT 'RLS policies created successfully!' as status;
