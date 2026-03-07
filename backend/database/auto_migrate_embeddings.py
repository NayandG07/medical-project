"""
Auto-migrate embedding dimensions based on the configured model
This script detects the embedding model's dimensions and updates the database schema accordingly
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from supabase import create_client
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def get_embedding_dimension():
    """Get the dimension of the configured embedding model"""
    try:
        from services.providers.huggingface import get_huggingface_provider
        
        provider = get_huggingface_provider()
        if not provider or not provider.inference_client:
            logger.error("HuggingFace provider not available")
            return None
        
        # Generate a test embedding to detect dimensions
        result = await provider.generate_embedding("test", prepend_instruction=False)
        
        if result["success"] and result["embedding"]:
            dimension = len(result["embedding"])
            logger.info(f"Detected embedding dimension: {dimension}")
            return dimension
        else:
            logger.error(f"Failed to generate test embedding: {result.get('error')}")
            return None
            
    except Exception as e:
        logger.error(f"Failed to detect embedding dimension: {str(e)}")
        return None


async def get_current_db_dimension(supabase):
    """Get the current embedding dimension in the database"""
    try:
        # Query the database to check current vector dimension
        result = supabase.rpc('get_embedding_dimension').execute()
        
        if result.data:
            return result.data
        
        # Fallback: Try to infer from a sample embedding
        chunks = supabase.table("document_chunks").select("embedding").limit(1).execute()
        
        if chunks.data and len(chunks.data) > 0 and chunks.data[0].get("embedding"):
            # Parse the vector string to count dimensions
            embedding_str = chunks.data[0]["embedding"]
            if isinstance(embedding_str, str):
                # Format: [1.0,2.0,3.0,...]
                values = embedding_str.strip('[]').split(',')
                return len(values)
        
        logger.warning("Could not determine current database dimension")
        return None
        
    except Exception as e:
        logger.warning(f"Could not query current dimension: {str(e)}")
        return None


async def migrate_database(supabase, target_dimension: int):
    """Migrate database to support target embedding dimension"""
    try:
        logger.info(f"Migrating database to support {target_dimension}-dimensional embeddings...")
        
        # Step 1: Drop existing index
        logger.info("Dropping existing embedding index...")
        supabase.rpc('execute_sql', {
            'sql': 'DROP INDEX IF EXISTS idx_document_chunks_embedding'
        }).execute()
        
        # Step 2: Alter column type
        logger.info(f"Altering embedding column to VECTOR({target_dimension})...")
        supabase.rpc('execute_sql', {
            'sql': f'ALTER TABLE document_chunks ALTER COLUMN embedding TYPE VECTOR({target_dimension})'
        }).execute()
        
        # Step 3: Recreate index
        logger.info("Recreating embedding index...")
        supabase.rpc('execute_sql', {
            'sql': f'''
                CREATE INDEX idx_document_chunks_embedding 
                ON document_chunks 
                USING ivfflat (embedding vector_cosine_ops) 
                WITH (lists = 100)
            '''
        }).execute()
        
        # Step 4: Update RPC function
        logger.info("Updating match_document_chunks function...")
        supabase.rpc('execute_sql', {
            'sql': f'''
                CREATE OR REPLACE FUNCTION match_document_chunks(
                    query_embedding VECTOR({target_dimension}),
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
                $$
            '''
        }).execute()
        
        logger.info(f"✅ Database successfully migrated to {target_dimension} dimensions")
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        return False


async def main():
    """Main migration function"""
    logger.info("=== Embedding Dimension Auto-Migration ===")
    
    # Initialize Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        logger.error("SUPABASE_URL or SUPABASE_SERVICE_KEY not set")
        return False
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Detect embedding model dimension
    target_dimension = await get_embedding_dimension()
    
    if not target_dimension:
        logger.error("Could not detect embedding dimension. Please check your HuggingFace configuration.")
        return False
    
    # Check current database dimension
    current_dimension = await get_current_db_dimension(supabase)
    
    if current_dimension == target_dimension:
        logger.info(f"✅ Database already configured for {target_dimension} dimensions. No migration needed.")
        return True
    
    logger.info(f"Current database dimension: {current_dimension or 'unknown'}")
    logger.info(f"Target dimension: {target_dimension}")
    
    # Perform migration
    success = await migrate_database(supabase, target_dimension)
    
    if success:
        logger.info("✅ Migration completed successfully!")
        logger.info(f"Database now supports {target_dimension}-dimensional embeddings")
    else:
        logger.error("❌ Migration failed. Please check the logs and try manual migration.")
    
    return success


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
