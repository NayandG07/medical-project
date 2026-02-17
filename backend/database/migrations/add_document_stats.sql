-- Add statistics columns to documents table for better monitoring
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS chunks_with_embeddings INTEGER DEFAULT 0;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_user_feature ON public.documents(user_id, feature);

-- Add comment
COMMENT ON COLUMN public.documents.total_chunks IS 'Total number of chunks created from this document';
COMMENT ON COLUMN public.documents.chunks_with_embeddings IS 'Number of chunks that have embeddings generated';
