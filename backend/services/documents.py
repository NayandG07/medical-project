"""
Document Service
Handles PDF/image upload, processing, embedding generation, and RAG
"""
import os
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from supabase import Client
import logging
import PyPDF2
import io
from PIL import Image
import pytesseract

logger = logging.getLogger(__name__)


class DocumentService:
    """Service for document upload, processing, and RAG"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.storage_bucket = "documents"
        self.hf_provider = None
        self._init_hf_provider()
    
    def _init_hf_provider(self):
        """Initialize HuggingFace provider for embeddings"""
        try:
            from services.providers.huggingface import get_huggingface_provider
            self.hf_provider = get_huggingface_provider()
            if self.hf_provider and self.hf_provider.inference_client:
                logger.info("HuggingFace provider initialized for embeddings")
            else:
                logger.warning("HuggingFace provider not available - embeddings will not be generated")
        except Exception as e:
            logger.error(f"Failed to initialize HuggingFace provider: {str(e)}")
            self.hf_provider = None
        
    async def upload_document(
        self,
        user_id: str,
        file_content: bytes,
        filename: str,
        file_type: str,
        feature: str = "chat"
    ) -> Dict[str, Any]:
        """
        Upload a document and initiate processing
        
        Args:
            user_id: User ID
            file_content: File bytes
            filename: Original filename
            file_type: MIME type
            feature: Feature to enable RAG for (chat, mcq, flashcard, explain, highyield)
        
        Returns:
            Document metadata
        """
        try:
            # Generate unique storage path
            file_extension = filename.split('.')[-1] if '.' in filename else 'pdf'
            storage_filename = f"{user_id}/{uuid.uuid4()}.{file_extension}"
            
            # Calculate file size and hash
            file_size = len(file_content)
            file_hash = hashlib.sha256(file_content).hexdigest()
            
            # Upload to Supabase Storage
            try:
                self.supabase.storage.from_(self.storage_bucket).upload(
                    storage_filename,
                    file_content,
                    {"content-type": file_type}
                )
            except Exception as storage_error:
                logger.error(f"Storage upload failed: {str(storage_error)}")
                # If bucket doesn't exist, create it
                try:
                    self.supabase.storage.create_bucket(self.storage_bucket, {"public": False})
                    self.supabase.storage.from_(self.storage_bucket).upload(
                        storage_filename,
                        file_content,
                        {"content-type": file_type}
                    )
                except Exception as e:
                    raise Exception(f"Failed to upload to storage: {str(e)}")
            
            # Get user's plan and retention days
            retention_days = await self._get_retention_days_for_user(user_id)
            expires_at = datetime.now() + timedelta(days=retention_days)
            
            # Create document record
            document_data = {
                "user_id": user_id,
                "filename": filename,
                "file_type": file_type,
                "file_size": file_size,
                "storage_path": storage_filename,
                "processing_status": "pending",
                "feature": feature,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now().isoformat()
            }
            
            result = self.supabase.table("documents").insert(document_data).execute()
            
            if not result.data:
                raise Exception("Failed to create document record")
            
            document = result.data[0]
            
            # Start async processing
            await self._process_document_async(document["id"], file_content, file_type)
            
            return document
            
        except Exception as e:
            logger.error(f"Document upload failed: {str(e)}")
            raise
    
    async def _get_retention_days_for_user(self, user_id: str) -> int:
        """Get document retention days based on user's plan"""
        try:
            # Get user's plan
            user_result = self.supabase.table("users").select("plan").eq("id", user_id).execute()
            
            if not user_result.data:
                return 14  # Default
            
            plan = user_result.data[0].get("plan", "free")
            
            # Get retention days for this plan
            flag_name = f"document_retention_{plan}"
            result = self.supabase.table("system_flags").select("flag_value").eq("flag_name", flag_name).execute()
            
            if result.data:
                return int(result.data[0]["flag_value"])
            
            # Default retention per plan
            defaults = {
                "free": 7,
                "student": 14,
                "pro": 30
            }
            return defaults.get(plan, 14)
        except Exception as e:
            logger.warning(f"Failed to get retention days for user: {str(e)}")
            return 14
    
    async def _get_retention_days(self, feature: str) -> int:
        """Get document retention days based on user's plan (deprecated, kept for compatibility)"""
        try:
            defaults = {
                "chat": 30,
                "mcq": 14,
                "flashcard": 14,
                "explain": 7,
                "highyield": 7
            }
            return defaults.get(feature, 14)
        except Exception as e:
            logger.warning(f"Failed to get retention days: {str(e)}")
            return 14
    
    async def _process_document_async(self, document_id: str, file_content: bytes, file_type: str):
        """
        Process document: extract text, chunk, generate embeddings
        This should ideally run in a background task/queue
        """
        try:
            # Update status to processing
            self.supabase.table("documents").update({
                "processing_status": "processing"
            }).eq("id", document_id).execute()
            
            # Extract text based on file type
            if file_type == "application/pdf":
                text = await self._extract_pdf_text(file_content)
            elif file_type.startswith("image/"):
                text = await self._extract_image_text(file_content)
            else:
                raise Exception(f"Unsupported file type: {file_type}")
            
            if not text or len(text.strip()) < 10:
                # For image-based PDFs or documents with minimal text, 
                # still mark as completed with a note
                logger.warning(f"Document {document_id} has minimal extractable text")
                text = "Document uploaded. Limited text extraction available."
            
            # Chunk text
            chunks = self._chunk_text(text)
            
            # Generate embeddings and store chunks
            await self._store_chunks_with_embeddings(document_id, chunks)
            
            # Update status to completed
            self.supabase.table("documents").update({
                "processing_status": "completed",
                "processed_at": datetime.now().isoformat()
            }).eq("id", document_id).execute()
            
            logger.info(f"Document {document_id} processed successfully")
            
        except Exception as e:
            logger.error(f"Document processing failed: {str(e)}")
            self.supabase.table("documents").update({
                "processing_status": "failed",
                "error_message": str(e)
            }).eq("id", document_id).execute()
    
    async def _extract_pdf_text(self, file_content: bytes) -> str:
        """Extract text from PDF"""
        try:
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text = ""
            for page_num, page in enumerate(pdf_reader.pages):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n\n"
                except Exception as page_error:
                    logger.warning(f"Failed to extract text from page {page_num}: {str(page_error)}")
                    continue
            
            extracted_text = text.strip()
            
            # If no text extracted, it might be an image-based PDF
            if not extracted_text or len(extracted_text) < 50:
                logger.warning("PDF appears to be image-based or has minimal text. Consider using OCR.")
                # Return a placeholder message instead of failing
                return "PDF uploaded successfully. This appears to be an image-based PDF. Text extraction may be limited. You can still use this document for reference."
            
            return extracted_text
        except Exception as e:
            logger.error(f"PDF text extraction failed: {str(e)}")
            # Don't fail completely, return a message
            return "PDF uploaded successfully. Text extraction encountered an issue, but the document is stored and can be referenced."
    
    async def _extract_image_text(self, file_content: bytes) -> str:
        """Extract text from image using OCR"""
        try:
            image = Image.open(io.BytesIO(file_content))
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            logger.error(f"Image OCR failed: {str(e)}")
            # OCR might not be available, return placeholder
            return "Image uploaded. OCR processing requires tesseract installation."
    
    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks"""
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = start + chunk_size
            chunk = text[start:end]
            
            # Try to break at sentence boundary
            if end < text_length:
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                
                if break_point > chunk_size * 0.5:  # Only break if we're past halfway
                    chunk = chunk[:break_point + 1]
                    end = start + break_point + 1
            
            chunks.append(chunk.strip())
            start = end - overlap
        
        return [c for c in chunks if len(c.strip()) > 50]  # Filter out tiny chunks
    
    async def _store_chunks_with_embeddings(self, document_id: str, chunks: List[str]):
        """Store text chunks with embeddings"""
        try:
            for i, chunk in enumerate(chunks):
                # Generate embedding if HuggingFace provider is available
                embedding = None
                if self.hf_provider:
                    try:
                        # Don't prepend instruction for documents/passages
                        result = await self.hf_provider.generate_embedding(chunk, prepend_instruction=False)
                        if result["success"]:
                            embedding = result["embedding"]
                            logger.info(f"Generated embedding for chunk {i}, dimension: {len(embedding) if embedding else 0}")
                        else:
                            logger.error(f"Failed to generate embedding for chunk {i}: {result['error']}")
                    except Exception as e:
                        logger.error(f"Failed to generate embedding for chunk {i}: {str(e)}")
                
                chunk_data = {
                    "document_id": document_id,
                    "chunk_index": i,
                    "content": chunk,
                    "embedding": embedding,
                    "created_at": datetime.now().isoformat()
                }
                
                self.supabase.table("document_chunks").insert(chunk_data).execute()
            
            logger.info(f"Stored {len(chunks)} chunks for document {document_id}")
            
        except Exception as e:
            logger.error(f"Failed to store chunks: {str(e)}")
            raise
    
    async def get_user_documents(self, user_id: str, feature: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get user's documents, optionally filtered by feature"""
        try:
            query = self.supabase.table("documents").select("*").eq("user_id", user_id).order("created_at", desc=True)
            
            if feature:
                query = query.eq("feature", feature)
            
            result = query.execute()
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get user documents: {str(e)}")
            return []
    
    async def delete_document(self, user_id: str, document_id: str):
        """Delete a document and its chunks"""
        try:
            # Get document
            doc_result = self.supabase.table("documents").select("*").eq("id", document_id).eq("user_id", user_id).execute()
            
            if not doc_result.data:
                raise Exception("Document not found or access denied")
            
            document = doc_result.data[0]
            
            # Delete from storage
            try:
                self.supabase.storage.from_(self.storage_bucket).remove([document["storage_path"]])
            except Exception as e:
                logger.warning(f"Failed to delete from storage: {str(e)}")
            
            # Delete chunks
            self.supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
            
            # Delete document record
            self.supabase.table("documents").delete().eq("id", document_id).execute()
            
            logger.info(f"Document {document_id} deleted successfully")
            
        except Exception as e:
            logger.error(f"Failed to delete document: {str(e)}")
            raise
    
    async def search_documents(
        self,
        user_id: str,
        query: str,
        feature: Optional[str] = None,
        top_k: int = 5,
        document_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant document chunks using vector similarity or text search
        
        Args:
            user_id: User ID
            query: Search query
            feature: Optional feature filter
            top_k: Number of results to return
            document_id: Optional specific document ID to search within
        
        Returns:
            List of relevant chunks with metadata
        """
        try:
            # Log RAG usage for monitoring
            await self._log_rag_usage(user_id, feature or "unknown", query, document_id)
            
            # Get user's documents
            docs_query = self.supabase.table("documents").select("id").eq("user_id", user_id).eq("processing_status", "completed")
            
            if feature:
                docs_query = docs_query.eq("feature", feature)
            
            if document_id:
                docs_query = docs_query.eq("id", document_id)
            
            docs_result = docs_query.execute()
            
            if not docs_result.data:
                return []
            
            doc_ids = [d["id"] for d in docs_result.data]
            
            # Try vector similarity search if embeddings are available
            if self.hf_provider:
                try:
                    # Generate query embedding with instruction for better retrieval
                    result = await self.hf_provider.generate_embedding(query, prepend_instruction=True)
                    
                    if result["success"] and result["embedding"]:
                        query_embedding = result["embedding"]
                        
                        # Use pgvector similarity search
                        chunks_result = self.supabase.rpc(
                            'match_document_chunks',
                            {
                                'query_embedding': query_embedding,
                                'match_count': top_k,
                                'filter_doc_ids': doc_ids
                            }
                        ).execute()
                        
                        if chunks_result.data:
                            logger.info(f"Vector search returned {len(chunks_result.data)} results")
                            await self._log_rag_usage(user_id, feature or "unknown", query, document_id, len(chunks_result.data))
                            return chunks_result.data
                    else:
                        logger.warning(f"Embedding generation failed: {result.get('error')}")
                except Exception as e:
                    logger.warning(f"Vector search failed, falling back to text search: {str(e)}")
            
            # Fallback to simple text search
            chunks_result = self.supabase.table("document_chunks").select("*, documents(filename)").in_("document_id", doc_ids).ilike("content", f"%{query}%").limit(top_k).execute()
            
            # Log RAG usage for monitoring
            results = chunks_result.data or []
            await self._log_rag_usage(user_id, feature or "unknown", query, document_id, len(results))
            
            logger.info(f"Text search returned {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"Document search failed: {str(e)}")
            return []
    
    async def _log_rag_usage(self, user_id: str, feature: str, query: str, document_id: Optional[str] = None, results_count: int = 0):
        """Log RAG usage for monitoring"""
        try:
            log_data = {
                "user_id": user_id,
                "feature": feature,
                "query_preview": query[:100],  # First 100 chars
                "document_id": document_id,
                "timestamp": datetime.now().isoformat(),
                "success": True,
                "results_count": results_count
            }
            
            self.supabase.table("rag_usage_logs").insert(log_data).execute()
        except Exception as e:
            logger.error(f"Failed to log RAG usage: {str(e)}")
    
    async def cleanup_expired_documents(self):
        """Delete expired documents (run as scheduled job)"""
        try:
            now = datetime.now().isoformat()
            expired = self.supabase.table("documents").select("*").lt("expires_at", now).execute()
            
            for doc in expired.data or []:
                await self.delete_document(doc["user_id"], doc["id"])
            
            logger.info(f"Cleaned up {len(expired.data or [])} expired documents")
            
        except Exception as e:
            logger.error(f"Cleanup failed: {str(e)}")


def get_document_service(supabase: Client) -> DocumentService:
    """Factory function to get document service instance"""
    return DocumentService(supabase)
