-- Add document upload counters to usage_counters table
-- These track per-feature document uploads

-- Add columns for each feature's document uploads
ALTER TABLE usage_counters 
ADD COLUMN IF NOT EXISTS chat_uploads_per_day INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS mcq_uploads_per_day INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS flashcard_uploads_per_day INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS explain_uploads_per_day INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS highyield_uploads_per_day INTEGER NOT NULL DEFAULT 0;

-- Add comments
COMMENT ON COLUMN usage_counters.chat_uploads_per_day IS 'Number of documents uploaded for chat feature today';
COMMENT ON COLUMN usage_counters.mcq_uploads_per_day IS 'Number of documents uploaded for MCQ feature today';
COMMENT ON COLUMN usage_counters.flashcard_uploads_per_day IS 'Number of documents uploaded for flashcard feature today';
COMMENT ON COLUMN usage_counters.explain_uploads_per_day IS 'Number of documents uploaded for explain feature today';
COMMENT ON COLUMN usage_counters.highyield_uploads_per_day IS 'Number of documents uploaded for high yield feature today';
