-- ============================================================================
-- Medical Images Table
-- ============================================================================
-- Separate table for medical image classification and analysis
-- This is independent from the RAG document system
-- ============================================================================

-- Create medical_images table
CREATE TABLE IF NOT EXISTS medical_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- File metadata
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    
    -- Image properties
    width INTEGER,
    height INTEGER,
    format TEXT,
    
    -- Classification
    category TEXT, -- xray, ct, mri, ultrasound, pathology, dermatology, etc.
    image_type TEXT, -- Detected by AI
    body_region TEXT, -- Detected by AI
    
    -- Analysis
    analysis_status TEXT NOT NULL DEFAULT 'pending', -- pending, analyzing, completed, failed
    analysis_text TEXT,
    findings TEXT[],
    clinical_impression TEXT,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_analysis_status CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed'))
);

-- Create indexes
CREATE INDEX idx_medical_images_user_id ON medical_images(user_id);
CREATE INDEX idx_medical_images_category ON medical_images(category);
CREATE INDEX idx_medical_images_analysis_status ON medical_images(analysis_status);
CREATE INDEX idx_medical_images_created_at ON medical_images(created_at DESC);
CREATE INDEX idx_medical_images_image_type ON medical_images(image_type);
CREATE INDEX idx_medical_images_body_region ON medical_images(body_region);

-- Full-text search index for analysis
CREATE INDEX idx_medical_images_analysis_text ON medical_images USING gin(to_tsvector('english', COALESCE(analysis_text, '')));

-- Enable Row Level Security
ALTER TABLE medical_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own medical images"
    ON medical_images FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own medical images"
    ON medical_images FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own medical images"
    ON medical_images FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own medical images"
    ON medical_images FOR DELETE
    USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE medical_images IS 'Stores medical images for AI-powered analysis and classification';
COMMENT ON COLUMN medical_images.category IS 'User-specified or auto-detected image category';
COMMENT ON COLUMN medical_images.image_type IS 'AI-detected image modality (X-ray, CT, MRI, etc.)';
COMMENT ON COLUMN medical_images.body_region IS 'AI-detected anatomical region';
COMMENT ON COLUMN medical_images.findings IS 'Array of key findings from AI analysis';
COMMENT ON COLUMN medical_images.clinical_impression IS 'AI-generated clinical assessment';

-- ============================================================================
-- Medical Image Statistics View
-- ============================================================================

CREATE OR REPLACE VIEW medical_image_stats AS
SELECT 
    user_id,
    COUNT(*) as total_images,
    COUNT(CASE WHEN analysis_status = 'completed' THEN 1 END) as analyzed_images,
    COUNT(CASE WHEN analysis_status = 'pending' THEN 1 END) as pending_images,
    COUNT(CASE WHEN analysis_status = 'failed' THEN 1 END) as failed_images,
    COUNT(DISTINCT category) as unique_categories,
    SUM(file_size) as total_storage_bytes,
    MAX(created_at) as last_upload_at
FROM medical_images
GROUP BY user_id;

COMMENT ON VIEW medical_image_stats IS 'Aggregated statistics for medical images per user';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check table created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'medical_images';

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'medical_images';
