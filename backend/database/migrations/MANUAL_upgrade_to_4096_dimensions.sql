-- ============================================================================
-- MANUAL MIGRATION: Upgrade Embeddings to 4096 Dimensions
-- ============================================================================
-- This migration upgrades the embedding system to use Qwen3-Embedding-8B
-- which provides 4096-dimensional vectors for superior semantic understanding
--
-- IMPORTANT: Run this in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Check current dimension (optional - for verification)
-- SELECT 
--     column_name, 
--     udt_name,
--     character_maximum_length
-- FROM information_schema.columns 
-- WHERE table_name = 'document_chunks' AND column_name = 'embedding';

-- Step 2: Drop existing index (required before altering column type)
DROP INDEX IF EXISTS idx_document_chunks_embedding;

-- Step 3: Clear existing embeddings (they're incompatible with new dimensions)
-- WARNING: This will require re-processing all documents
UPDATE document_chunks SET embedding = NULL;

-- Step 4: Alter the embedding column to support 4096 dimensions
-- Split into 3 parts for indexing (pgvector limit is 2000 dims)
-- Part 1: dims 1-1365, Part 2: dims 1366-2730, Part 3: dims 2731-4096
ALTER TABLE document_chunks 
ALTER COLUMN embedding TYPE VECTOR(4096);

-- Add split embedding columns for indexing
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS embedding_part1 VECTOR(1365),
ADD COLUMN IF NOT EXISTS embedding_part2 VECTOR(1365),
ADD COLUMN IF NOT EXISTS embedding_part3 VECTOR(1366);

-- Step 5: Create indexes on split embeddings (3 parts to stay under 2000 limit)
CREATE INDEX idx_document_chunks_embedding_part1 
ON document_chunks 
USING hnsw (embedding_part1 vector_cosine_ops);

CREATE INDEX idx_document_chunks_embedding_part2 
ON document_chunks 
USING hnsw (embedding_part2 vector_cosine_ops);

CREATE INDEX idx_document_chunks_embedding_part3 
ON document_chunks 
USING hnsw (embedding_part3 vector_cosine_ops);

-- Step 6: Update the RPC function to use split embeddings for search
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
DECLARE
    query_part1 VECTOR(1365);
    query_part2 VECTOR(1365);
    query_part3 VECTOR(1366);
BEGIN
    -- Split query embedding into three parts
    query_part1 := query_embedding[1:1365];
    query_part2 := query_embedding[1366:2730];
    query_part3 := query_embedding[2731:4096];
    
    RETURN QUERY
    SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.chunk_index,
        -- Combined similarity: average of all three parts
        (
            (1 - (dc.embedding_part1 <=> query_part1)) + 
            (1 - (dc.embedding_part2 <=> query_part2)) +
            (1 - (dc.embedding_part3 <=> query_part3))
        ) / 3.0 AS similarity
    FROM document_chunks dc
    WHERE 
        (filter_doc_ids IS NULL OR dc.document_id = ANY(filter_doc_ids))
        AND dc.embedding IS NOT NULL
        AND dc.embedding_part1 IS NOT NULL
        AND dc.embedding_part2 IS NOT NULL
        AND dc.embedding_part3 IS NOT NULL
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Step 7: Update document processing status to trigger re-processing
-- This marks all documents as needing re-processing with new embeddings
UPDATE documents 
SET processing_status = 'pending',
    processed_at = NULL,
    chunks_with_embeddings = 0
WHERE processing_status = 'completed';

-- Step 8: Add comment explaining the dimension choice
COMMENT ON COLUMN document_chunks.embedding IS 
'Vector embedding (4096 dimensions) using Qwen3-Embedding-8B for superior semantic understanding and retrieval quality';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify column type changed
SELECT 
    column_name, 
    udt_name,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'document_chunks' AND column_name = 'embedding';

-- Check documents pending re-processing
SELECT 
    COUNT(*) as total_documents,
    COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed
FROM documents;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- 1. Restart your backend server to pick up the new embedding model
-- 2. Documents will be automatically re-processed with 4096-dimensional embeddings
-- 3. Or manually trigger re-processing by re-uploading documents
-- ============================================================================
