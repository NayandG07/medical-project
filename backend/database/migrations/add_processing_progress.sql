-- Add processing progress tracking columns to documents table

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_stage TEXT DEFAULT 'Pending';

-- Add comment
COMMENT ON COLUMN documents.processing_progress IS 'Processing progress percentage (0-100)';
COMMENT ON COLUMN documents.processing_stage IS 'Current processing stage description';
