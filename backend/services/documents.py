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
        self.embedding_dimension = None  # Will be detected dynamically
        self._init_hf_provider()
    
    def _init_hf_provider(self):
        """Initialize HuggingFace provider for embeddings"""
        try:
            from services.providers.huggingface import get_huggingface_provider
            self.hf_provider = get_huggingface_provider()
            if self.hf_provider and self.hf_provider.inference_client:
                logger.info("HuggingFace provider initialized for embeddings")
                # Detect embedding dimension on first use
                self._detect_embedding_dimension()
            else:
                logger.warning("HuggingFace provider not available - embeddings will not be generated")
        except Exception as e:
            logger.error(f"Failed to initialize HuggingFace provider: {str(e)}")
            self.hf_provider = None
    
    def _detect_embedding_dimension(self):
        """Detect the embedding dimension from the model"""
        try:
            # This will be set when we generate the first embedding
            # For now, we'll detect it dynamically during embedding generation
            pass
        except Exception as e:
            logger.warning(f"Could not detect embedding dimension: {str(e)}")
        
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
                "processing_status": "processing",
                "processing_progress": 10,
                "processing_stage": "Extracting text..."
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
            
            # Update progress
            self.supabase.table("documents").update({
                "processing_progress": 30,
                "processing_stage": "Chunking text..."
            }).eq("id", document_id).execute()
            
            # Chunk text
            chunks = self._chunk_text(text)
            
            # Update progress
            self.supabase.table("documents").update({
                "processing_progress": 50,
                "processing_stage": f"Generating embeddings (0/{len(chunks)})..."
            }).eq("id", document_id).execute()
            
            # Generate embeddings and store chunks
            await self._store_chunks_with_embeddings(document_id, chunks)
            
            # Update status to completed
            self.supabase.table("documents").update({
                "processing_status": "completed",
                "processing_progress": 100,
                "processing_stage": "Completed",
                "processed_at": datetime.now().isoformat()
            }).eq("id", document_id).execute()
            
            logger.info(f"Document {document_id} processed successfully")
            
        except Exception as e:
            logger.error(f"Document processing failed: {str(e)}")
            self.supabase.table("documents").update({
                "processing_status": "failed",
                "processing_progress": 0,
                "processing_stage": "Failed",
                "error_message": str(e)
            }).eq("id", document_id).execute()
    
    async def _extract_pdf_text(self, file_content: bytes) -> str:
        """Extract text from PDF - handles both text-based and image-based PDFs"""
        try:
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text = ""
            total_pages = len(pdf_reader.pages)
            pages_with_text = 0
            
            # First pass: Try to extract text from all pages
            for page_num, page in enumerate(pdf_reader.pages):
                try:
                    page_text = page.extract_text()
                    if page_text and len(page_text.strip()) > 20:  # Meaningful text threshold
                        text += page_text + "\n\n"
                        pages_with_text += 1
                except Exception as page_error:
                    logger.warning(f"Failed to extract text from page {page_num}: {str(page_error)}")
                    continue
            
            extracted_text = text.strip()
            
            # Check if we got meaningful text from most pages
            text_coverage = pages_with_text / total_pages if total_pages > 0 else 0
            
            if text_coverage < 0.3 or len(extracted_text) < 100:
                # This appears to be an image-based PDF
                logger.warning(f"PDF appears to be image-based (text coverage: {text_coverage:.1%}). Attempting OCR...")
                
                # Try OCR on the PDF
                try:
                    ocr_text = await self._extract_pdf_with_ocr(file_content)
                    if ocr_text and len(ocr_text.strip()) > 50:
                        logger.info(f"OCR extraction successful, extracted {len(ocr_text)} characters")
                        return ocr_text
                    else:
                        logger.warning("OCR extraction yielded minimal text")
                except Exception as ocr_error:
                    logger.warning(f"OCR extraction failed: {str(ocr_error)}")
                
                # If OCR fails or yields nothing, return what we have with a note
                if extracted_text:
                    return extracted_text + "\n\n[Note: This PDF may contain images. Some content might not be fully extracted.]"
                else:
                    return "PDF uploaded successfully. This appears to be an image-based PDF. Text extraction is limited. You can still use this document for reference."
            
            return extracted_text
        except Exception as e:
            logger.error(f"PDF text extraction failed: {str(e)}")
            return "PDF uploaded successfully. Text extraction encountered an issue, but the document is stored and can be referenced."
    
    async def _extract_pdf_with_ocr(self, file_content: bytes) -> str:
        """Extract text from image-based PDF using OCR"""
        try:
            # Set tesseract path for Windows if needed
            import platform
            if platform.system() == 'Windows':
                possible_tesseract_paths = [
                    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                    r"C:\Tesseract-OCR\tesseract.exe",
                ]
                for path in possible_tesseract_paths:
                    if os.path.exists(path):
                        pytesseract.pytesseract.tesseract_cmd = path
                        logger.info(f"Found tesseract at: {path}")
                        break
            
            # Try to use pdf2image if available
            try:
                from pdf2image import convert_from_bytes
                
                # Set poppler path for Windows
                poppler_path = None
                if platform.system() == 'Windows':
                    # Common Windows poppler locations
                    possible_paths = [
                        r"C:\Program Files\poppler\Library\bin",
                        r"C:\poppler\Library\bin",
                        r"C:\ProgramData\chocolatey\lib\poppler\tools\poppler-26.02.0\bin",
                    ]
                    for path in possible_paths:
                        if os.path.exists(path):
                            poppler_path = path
                            logger.info(f"Found poppler at: {poppler_path}")
                            break
                
                # Convert PDF pages to images
                if poppler_path:
                    images = convert_from_bytes(file_content, dpi=200, poppler_path=poppler_path)
                else:
                    images = convert_from_bytes(file_content, dpi=200)
                
                ocr_text = ""
                for i, image in enumerate(images):
                    try:
                        page_text = pytesseract.image_to_string(image)
                        if page_text and len(page_text.strip()) > 10:
                            ocr_text += f"\n\n--- Page {i+1} ---\n\n{page_text}"
                    except Exception as page_error:
                        logger.warning(f"OCR failed for page {i+1}: {str(page_error)}")
                        continue
                
                return ocr_text.strip()
            except ImportError:
                logger.warning("pdf2image not available for OCR. Install with: pip install pdf2image")
                return ""
        except Exception as e:
            logger.error(f"PDF OCR extraction failed: {str(e)}")
            return ""
    
    async def _extract_image_text(self, file_content: bytes) -> str:
        """Extract text from image using OCR"""
        try:
            # Set tesseract path for Windows if needed
            import platform
            if platform.system() == 'Windows':
                possible_tesseract_paths = [
                    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                    r"C:\Tesseract-OCR\tesseract.exe",
                ]
                for path in possible_tesseract_paths:
                    if os.path.exists(path):
                        pytesseract.pytesseract.tesseract_cmd = path
                        logger.info(f"Found tesseract at: {path}")
                        break
            
            image = Image.open(io.BytesIO(file_content))
            
            # Preprocess image for better OCR results
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Perform OCR
            text = pytesseract.image_to_string(image, config='--psm 3')
            extracted_text = text.strip()
            
            if not extracted_text or len(extracted_text) < 10:
                logger.warning("Image OCR yielded minimal text")
                return "Image uploaded. Limited text detected. This may be a medical image or diagram."
            
            logger.info(f"Image OCR successful, extracted {len(extracted_text)} characters")
            return extracted_text
        except Exception as e:
            logger.error(f"Image OCR failed: {str(e)}")
            # Check if tesseract is installed
            if "tesseract" in str(e).lower() or "not installed" in str(e).lower():
                return "Image uploaded. OCR processing requires tesseract installation. Install with: choco install tesseract (run PowerShell as Admin)"
            return "Image uploaded. OCR processing encountered an issue."
    
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
            embeddings_generated = 0
            embeddings_failed = 0
            total_chunks = len(chunks)
            
            for i, chunk in enumerate(chunks):
                # Update progress every 5 chunks or on last chunk
                if i % 5 == 0 or i == total_chunks - 1:
                    progress = 50 + int((i / total_chunks) * 45)  # 50-95%
                    self.supabase.table("documents").update({
                        "processing_progress": progress,
                        "processing_stage": f"Generating embeddings ({i+1}/{total_chunks})..."
                    }).eq("id", document_id).execute()
                
                # Generate embedding if HuggingFace provider is available
                embedding = None
                if self.hf_provider:
                    try:
                        # Don't prepend instruction for documents/passages
                        result = await self.hf_provider.generate_embedding(chunk, prepend_instruction=False)
                        if result["success"]:
                            embedding = result["embedding"]
                            embeddings_generated += 1
                            
                            # Detect and store dimension on first successful embedding
                            if self.embedding_dimension is None and embedding:
                                self.embedding_dimension = len(embedding)
                                logger.info(f"Detected embedding dimension: {self.embedding_dimension}")
                            
                            if i == 0:  # Log first embedding details
                                logger.info(f"Generated embedding for chunk {i}, dimension: {len(embedding) if embedding else 0}")
                        else:
                            embeddings_failed += 1
                            logger.error(f"Failed to generate embedding for chunk {i}: {result.get('error')}")
                    except Exception as e:
                        embeddings_failed += 1
                        logger.error(f"Exception generating embedding for chunk {i}: {str(e)}")
                else:
                    logger.warning(f"HuggingFace provider not available for chunk {i}")
                
                # Format embedding as PostgreSQL vector string
                embedding_str = None
                embedding_part1_str = None
                embedding_part2_str = None
                embedding_part3_str = None
                
                if embedding:
                    # Convert list to PostgreSQL vector format: [1,2,3]
                    embedding_str = '[' + ','.join(str(x) for x in embedding) + ']'
                    
                    # Split into three parts for indexing (pgvector limit is 2000 dims)
                    # Part 1: 1-1365, Part 2: 1366-2730, Part 3: 2731-4096
                    if len(embedding) == 4096:
                        part1 = embedding[:1365]
                        part2 = embedding[1365:2730]
                        part3 = embedding[2730:]
                        embedding_part1_str = '[' + ','.join(str(x) for x in part1) + ']'
                        embedding_part2_str = '[' + ','.join(str(x) for x in part2) + ']'
                        embedding_part3_str = '[' + ','.join(str(x) for x in part3) + ']'
                
                chunk_data = {
                    "document_id": document_id,
                    "chunk_index": i,
                    "content": chunk,
                    "embedding": embedding_str,
                    "embedding_part1": embedding_part1_str,
                    "embedding_part2": embedding_part2_str,
                    "embedding_part3": embedding_part3_str,
                    "created_at": datetime.now().isoformat()
                }
                
                try:
                    self.supabase.table("document_chunks").insert(chunk_data).execute()
                except Exception as insert_error:
                    logger.error(f"Failed to insert chunk {i}: {str(insert_error)}")
                    raise
            
            # Final progress update
            self.supabase.table("documents").update({
                "processing_progress": 95,
                "processing_stage": "Finalizing..."
            }).eq("id", document_id).execute()
            
            logger.info(f"Stored {len(chunks)} chunks for document {document_id}. Embeddings: {embeddings_generated} generated, {embeddings_failed} failed")
            
            # Update document with embedding stats
            self.supabase.table("documents").update({
                "total_chunks": len(chunks),
                "chunks_with_embeddings": embeddings_generated
            }).eq("id", document_id).execute()
            
        except Exception as e:
            logger.error(f"Failed to store chunks: {str(e)}", exc_info=True)
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
            logger.info(f"Attempting to delete document {document_id} for user {user_id}")
            
            # Get document with better error handling
            doc_result = self.supabase.table("documents").select("*").eq("id", document_id).eq("user_id", user_id).execute()
            
            logger.info(f"Query result: {len(doc_result.data) if doc_result.data else 0} documents found")
            
            if not doc_result.data or len(doc_result.data) == 0:
                # Check if document exists but belongs to different user
                any_doc = self.supabase.table("documents").select("id, user_id").eq("id", document_id).execute()
                if any_doc.data and len(any_doc.data) > 0:
                    actual_user_id = any_doc.data[0].get("user_id")
                    logger.error(f"Access denied: Document {document_id} belongs to user {actual_user_id}, requested by user {user_id}")
                    raise Exception("Document not found or access denied")
                else:
                    logger.info(f"Document {document_id} not found in database (already deleted or never existed)")
                    # Try to clean up orphaned chunks silently
                    try:
                        chunks_deleted = self.supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
                        if chunks_deleted.data:
                            logger.info(f"Cleaned up {len(chunks_deleted.data)} orphaned chunks for {document_id}")
                    except Exception as cleanup_err:
                        logger.debug(f"Chunk cleanup skipped: {str(cleanup_err)}")
                    # Return success since the document is already gone
                    logger.info(f"Document {document_id} already deleted - returning success")
                    return
            
            document = doc_result.data[0]
            logger.info(f"Found document: {document.get('filename')} owned by {document.get('user_id')}")
            
            # Delete from storage
            try:
                storage_path = document.get("storage_path")
                if storage_path:
                    self.supabase.storage.from_(self.storage_bucket).remove([storage_path])
                    logger.info(f"Deleted storage file: {storage_path}")
            except Exception as e:
                logger.warning(f"Failed to delete from storage: {str(e)}")
            
            # Delete chunks
            try:
                chunks_result = self.supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
                logger.info(f"Deleted chunks for document {document_id}")
            except Exception as e:
                logger.warning(f"Failed to delete chunks: {str(e)}")
            
            # Delete document record
            try:
                self.supabase.table("documents").delete().eq("id", document_id).execute()
                logger.info(f"Deleted document record {document_id}")
            except Exception as e:
                logger.error(f"Failed to delete document record: {str(e)}")
                raise
            
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
            # Get user's documents
            docs_query = self.supabase.table("documents").select("id, filename, processing_status").eq("user_id", user_id)
            
            if feature:
                docs_query = docs_query.eq("feature", feature)
            
            if document_id:
                docs_query = docs_query.eq("id", document_id)
            
            docs_result = docs_query.execute()
            
            if not docs_result.data:
                logger.warning(f"No documents found for user {user_id}, feature: {feature}")
                return []
            
            # Check processing status
            completed_docs = [d for d in docs_result.data if d.get("processing_status") == "completed"]
            processing_docs = [d for d in docs_result.data if d.get("processing_status") == "processing"]
            failed_docs = [d for d in docs_result.data if d.get("processing_status") == "failed"]
            
            if processing_docs:
                logger.info(f"{len(processing_docs)} documents still processing")
            if failed_docs:
                logger.warning(f"{len(failed_docs)} documents failed processing")
            
            if not completed_docs:
                logger.warning(f"No completed documents available for search")
                return []
            
            doc_ids = [d["id"] for d in completed_docs]
            logger.info(f"Searching across {len(doc_ids)} completed documents")
            
            # Try vector similarity search if embeddings are available
            if self.hf_provider:
                try:
                    # Generate query embedding with instruction for better retrieval
                    result = await self.hf_provider.generate_embedding(query, prepend_instruction=True)
                    
                    if result["success"] and result["embedding"]:
                        query_embedding = result["embedding"]
                        logger.info(f"Generated query embedding, dimension: {len(query_embedding)}")
                        
                        # Format as PostgreSQL vector string
                        query_embedding_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
                        
                        # Use pgvector similarity search
                        try:
                            chunks_result = self.supabase.rpc(
                                'match_document_chunks',
                                {
                                    'query_embedding': query_embedding_str,
                                    'match_count': top_k,
                                    'filter_doc_ids': doc_ids
                                }
                            ).execute()
                            
                            if chunks_result.data and len(chunks_result.data) > 0:
                                logger.info(f"Vector search returned {len(chunks_result.data)} results")
                                await self._log_rag_usage(user_id, feature or "unknown", query, document_id, len(chunks_result.data))
                                return chunks_result.data
                            else:
                                logger.warning("Vector search returned no results, falling back to text search")
                        except Exception as rpc_error:
                            logger.error(f"RPC call failed: {str(rpc_error)}")
                            # Fall through to text search
                    else:
                        logger.warning(f"Embedding generation failed: {result.get('error')}")
                except Exception as e:
                    logger.warning(f"Vector search failed, falling back to text search: {str(e)}")
            else:
                logger.info("HuggingFace provider not available, using text search")
            
            # Fallback to simple text search
            logger.info(f"Performing text search for query: {query[:50]}...")
            chunks_result = self.supabase.table("document_chunks").select("*, documents(filename)").in_("document_id", doc_ids).ilike("content", f"%{query}%").limit(top_k).execute()
            
            # Log RAG usage for monitoring
            results = chunks_result.data or []
            await self._log_rag_usage(user_id, feature or "unknown", query, document_id, len(results))
            
            logger.info(f"Text search returned {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"Document search failed: {str(e)}", exc_info=True)
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
