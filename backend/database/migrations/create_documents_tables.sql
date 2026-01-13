-- Migration: Create document upload and RAG tables
-- Date: 2026-01-13
-- This script safely creates tables and columns, checking for existence first

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create documents table with minimal schema
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    filename TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add all columns one by one, checking if they exist
DO $$ 
BEGIN
    -- file_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'file_type') THEN
        ALTER TABLE documents ADD COLUMN file_type TEXT;
    END IF;
    
    -- file_size
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'file_size') THEN
        ALTER TABLE documents ADD COLUMN file_size INTEGER;
    END IF;
    
    -- storage_path
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'storage_path') THEN
        ALTER TABLE documents ADD COLUMN storage_path TEXT;
    END IF;
    
    -- processing_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'processing_status') THEN
        ALTER TABLE documents ADD COLUMN processing_status TEXT DEFAULT 'pending';
    END IF;
    
    -- error_message
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'error_message') THEN
        ALTER TABLE documents ADD COLUMN error_message TEXT;
    END IF;
    
    -- expires_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'expires_at') THEN
        ALTER TABLE documents ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- processed_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'processed_at') THEN
        ALTER TABLE documents ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'updated_at') THEN
        ALTER TABLE documents ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- feature
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'feature') THEN
        ALTER TABLE documents ADD COLUMN feature TEXT;
    END IF;
    
    -- file_hash
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'file_hash') THEN
        ALTER TABLE documents ADD COLUMN file_hash TEXT;
    END IF;
END $$;

-- Add constraints only if they don't exist
DO $$ 
BEGIN
    -- Add processing_status check constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_processing_status_check') THEN
        ALTER TABLE documents ADD CONSTRAINT documents_processing_status_check 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));
    END IF;
    
    -- Add feature check constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_feature_check') THEN
        ALTER TABLE documents ADD CONSTRAINT documents_feature_check 
        CHECK (feature IN ('chat', 'mcq', 'flashcard', 'explain', 'highyield'));
    END IF;
END $$;

-- Create document_chunks table for RAG
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Create indexes that depend on columns existing
DO $$
BEGIN
    -- Index on feature column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'feature') THEN
        CREATE INDEX IF NOT EXISTS idx_documents_feature ON documents(feature);
    END IF;
    
    -- Index on expires_at column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'expires_at') THEN
        CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON documents(expires_at);
    END IF;
    
    -- Index on file_hash column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'file_hash') THEN
        CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);
    END IF;
    
    -- Text search index on content
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_document_chunks_content') THEN
        CREATE INDEX idx_document_chunks_content ON document_chunks USING gin(to_tsvector('english', content));
    END IF;
END $$;

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
DROP POLICY IF EXISTS "Users can view chunks of own documents" ON document_chunks;
DROP POLICY IF EXISTS "System can insert chunks" ON document_chunks;
DROP POLICY IF EXISTS "System can delete chunks" ON document_chunks;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all chunks" ON document_chunks;

-- RLS Policies for documents
CREATE POLICY "Users can view own documents"
    ON documents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
    ON documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
    ON documents FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
    ON documents FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for document_chunks
CREATE POLICY "Users can view chunks of own documents"
    ON document_chunks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            WHERE documents.id = document_chunks.document_id
            AND documents.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert chunks"
    ON document_chunks FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can delete chunks"
    ON document_chunks FOR DELETE
    USING (true);

-- Admin policies (only if users table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        EXECUTE '
        CREATE POLICY "Admins can view all documents"
            ON documents FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE users.id = auth.uid()
                    AND users.role IN (''super_admin'', ''admin'', ''ops'')
                )
            );
        
        CREATE POLICY "Admins can view all chunks"
            ON document_chunks FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE users.id = auth.uid()
                    AND users.role IN (''super_admin'', ''admin'', ''ops'')
                )
            );
        ';
    END IF;
END $$;

-- Add comments
COMMENT ON TABLE documents IS 'Stores uploaded document metadata';
COMMENT ON TABLE document_chunks IS 'Stores text chunks from documents for RAG';
