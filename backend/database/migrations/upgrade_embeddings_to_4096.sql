-- Migration: Upgrade embedding dimensions from 384 to 4096
-- This allows using more powerful embedding models like Qwen3-Embedding-8B
-- Run this migration to support higher-dimensional embeddings

-- Step 1: Drop existing index (required before altering column type)
DROP INDEX IF EXISTS idx_document_chunks_embedding;

-- Step 2: Alter the embedding column to support 4096 dimensions
ALTER TABLE document_chunks 
ALTER COLUMN embedding TYPE VECTOR(4096);

-- Step 3: Recreate the index with new dimensions
-- Note: ivfflat has a 2000 dimension limit, so we use HNSW instead for 4096 dims
CREATE INDEX idx_document_chunks_embedding 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Step 4: Update the RPC function to accept 4096-dimensional vectors
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
        dc.id,
        dc.document_id,
        dc.content,
        dc.chunk_index,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    WHERE 
        (filter_doc_ids IS NULL OR dc.document_id = ANY(filter_doc_ids))
        AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Step 5: Add comment explaining the dimension choice
COMMENT ON COLUMN document_chunks.embedding IS 
'Vector embedding (4096 dimensions) using Qwen3-Embedding-8B for superior semantic understanding';

-- Verification query (run after migration)
-- SELECT 
--     column_name, 
--     data_type, 
--     character_maximum_length
-- FROM information_schema.columns 
-- WHERE table_name = 'document_chunks' AND column_name = 'embedding';
