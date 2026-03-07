-- Fix 1: Add foreign key relationship between document_chunks and documents
ALTER TABLE document_chunks
DROP CONSTRAINT IF EXISTS document_chunks_document_id_fkey;

ALTER TABLE document_chunks
ADD CONSTRAINT document_chunks_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

-- Fix 2: Update RPC function - PostgreSQL doesn't support vector subscripting
-- We'll use a simpler approach: just use the full embedding for now
DROP FUNCTION IF EXISTS match_document_chunks(vector, int, uuid[]);

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
    -- Use full embedding for similarity (no splitting needed for search)
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

-- Note: This will be slower without indexes, but it will work
-- The split columns are still useful for future optimization
