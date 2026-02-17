"""
Script to clean up orphaned documents and chunks
Run this to fix database inconsistencies
"""
import os
import sys
from supabase import create_client
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def cleanup_orphaned_chunks():
    """Remove chunks that reference non-existent documents"""
    try:
        # Get all chunks
        chunks_result = supabase.table("document_chunks").select("id, document_id").execute()
        chunks = chunks_result.data or []
        
        logger.info(f"Found {len(chunks)} total chunks")
        
        # Get all document IDs
        docs_result = supabase.table("documents").select("id").execute()
        valid_doc_ids = {d["id"] for d in (docs_result.data or [])}
        
        logger.info(f"Found {len(valid_doc_ids)} valid documents")
        
        # Find orphaned chunks
        orphaned = [c for c in chunks if c["document_id"] not in valid_doc_ids]
        
        if orphaned:
            logger.warning(f"Found {len(orphaned)} orphaned chunks")
            orphaned_doc_ids = {c["document_id"] for c in orphaned}
            logger.info(f"Orphaned document IDs: {orphaned_doc_ids}")
            
            # Delete orphaned chunks
            for doc_id in orphaned_doc_ids:
                result = supabase.table("document_chunks").delete().eq("document_id", doc_id).execute()
                logger.info(f"Deleted chunks for orphaned document {doc_id}")
        else:
            logger.info("No orphaned chunks found")
            
    except Exception as e:
        logger.error(f"Failed to cleanup orphaned chunks: {str(e)}")


def check_documents_without_chunks():
    """Find documents that have no chunks"""
    try:
        # Get all documents
        docs_result = supabase.table("documents").select("id, filename, processing_status").execute()
        docs = docs_result.data or []
        
        logger.info(f"Checking {len(docs)} documents")
        
        for doc in docs:
            chunks_result = supabase.table("document_chunks").select("id").eq("document_id", doc["id"]).execute()
            chunk_count = len(chunks_result.data or [])
            
            if chunk_count == 0 and doc["processing_status"] == "completed":
                logger.warning(f"Document {doc['id']} ({doc['filename']}) marked as completed but has no chunks")
                
    except Exception as e:
        logger.error(f"Failed to check documents: {str(e)}")


def update_document_stats():
    """Update total_chunks and chunks_with_embeddings for all documents"""
    try:
        docs_result = supabase.table("documents").select("id").execute()
        docs = docs_result.data or []
        
        logger.info(f"Updating stats for {len(docs)} documents")
        
        for doc in docs:
            chunks_result = supabase.table("document_chunks").select("id, embedding").eq("document_id", doc["id"]).execute()
            chunks = chunks_result.data or []
            
            total_chunks = len(chunks)
            chunks_with_embeddings = sum(1 for c in chunks if c.get("embedding") is not None)
            
            supabase.table("documents").update({
                "total_chunks": total_chunks,
                "chunks_with_embeddings": chunks_with_embeddings
            }).eq("id", doc["id"]).execute()
            
            logger.info(f"Document {doc['id']}: {total_chunks} chunks, {chunks_with_embeddings} with embeddings")
            
    except Exception as e:
        logger.error(f"Failed to update stats: {str(e)}")


if __name__ == "__main__":
    logger.info("Starting cleanup...")
    cleanup_orphaned_chunks()
    check_documents_without_chunks()
    
    # Apply migration
    logger.info("\nApplying migration...")
    try:
        with open("backend/database/migrations/add_document_stats.sql", "r") as f:
            sql = f.read()
            # Note: Supabase client doesn't support raw SQL execution
            # You need to run this migration manually in Supabase SQL editor
            logger.info("Please run the migration in add_document_stats.sql manually in Supabase SQL editor")
    except Exception as e:
        logger.error(f"Migration note: {str(e)}")
    
    logger.info("\nUpdating document stats...")
    update_document_stats()
    
    logger.info("\nCleanup complete!")
