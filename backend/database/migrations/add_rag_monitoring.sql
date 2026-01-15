-- Add RAG usage monitoring table
-- This tracks when RAG is used, which feature called it, and success metrics

CREATE TABLE IF NOT EXISTS rag_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL CHECK (feature IN ('chat', 'mcq', 'flashcard', 'explain', 'highyield', 'unknown')),
    query_preview TEXT,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    results_count INTEGER DEFAULT 0,
    grounding_score FLOAT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_logs_user_id ON rag_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_logs_feature ON rag_usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_rag_logs_timestamp ON rag_usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rag_logs_document_id ON rag_usage_logs(document_id);

-- Add embedding column to document_chunks if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'document_chunks' AND column_name = 'embedding') THEN
        ALTER TABLE document_chunks ADD COLUMN embedding VECTOR(384);
        CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
        ON document_chunks USING ivfflat (embedding vector_cosine_ops);
    END IF;
END $$;

-- Create RPC function for vector similarity search
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding VECTOR(384),
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
        document_chunks.id,
        document_chunks.document_id,
        document_chunks.content,
        document_chunks.chunk_index,
        1 - (document_chunks.embedding <=> query_embedding) AS similarity
    FROM document_chunks
    WHERE 
        (filter_doc_ids IS NULL OR document_chunks.document_id = ANY(filter_doc_ids))
        AND document_chunks.embedding IS NOT NULL
    ORDER BY document_chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Add comments
COMMENT ON TABLE rag_usage_logs IS 'Tracks RAG usage for monitoring and analytics';
COMMENT ON COLUMN rag_usage_logs.grounding_score IS 'Score indicating how well the response was grounded in document context (0-1)';
COMMENT ON FUNCTION match_document_chunks IS 'Vector similarity search for document chunks using cosine distance';
