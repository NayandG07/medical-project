-- ============================================================================
-- Add fallback_locks column to users table
-- For database-based fallback lock management
-- ============================================================================

-- Add fallback_locks JSONB column to users table
-- This stores per-feature fallback locks with expiration timestamps
-- Format: { "feature_name": { "locked_at": "ISO timestamp", "reason": "reason", "provider": "provider" } }
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS fallback_locks JSONB DEFAULT '{}';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_fallback_locks ON public.users USING GIN (fallback_locks);

-- Add comment
COMMENT ON COLUMN public.users.fallback_locks IS 'Per-feature fallback locks for seamless provider switching. Format: { "feature": { "locked_at": "ISO", "reason": "string", "provider": "string" } }';
