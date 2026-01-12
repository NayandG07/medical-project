"""
Document Service
Handles document upload, PDF processing, embedding generation, and semantic search
Requirements: 7.1, 7.2, 8.2, 8.4, 8.5
"""
import os
import io
from typing import Optional, Dict, Any, List, BinaryIO
from datetime import datetime, timezone
from supabase import Client, create_client
from dotenv import load_dotenv
import PyPDF2
from sentence_transformers import SentenceTransformer
import numpy as np
import base64

# Load environment variables
load_dotenv()


class DocumentService:
    """Document service for managing document uploads, processing, and RAG"""
    
    def __init__(self, supabase_client: Optional[Client] = None, model_router=None):
        """
        Initialize the document service
        
        Args:
            supabase_client: Optional Supabase client for dependency injection
            model_router: Optional ModelRouterService instance
        """
        if supabase_client:
            self.supabase = supabase_client
        else:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
            self.supabase = create_client(supabase_url, supabase_key)
        
        # Initialize model router
        if model_router:
            self.model_router = model_router
        else:
            from services.model_router import get_model_router_service
            self.model_router = get_model_router_service(self.supabase)

        # Initialize embedding model (using 768-dimensional model to match schema)
        self.embedding_model = SentenceTransformer('all-mpnet-base-v2')
        self.embedding_dimension = 768
    
    async def upload_document(
        self, 
        user_id: str, 
        file: BinaryIO,
        filename: str,
        file_type: str,
        file_size: int
    ) -> Dict[str, Any]:
        """
        Upload a document and create a database record
        
        Args:
            user_id: User's unique identifier
            file: File object (binary)
            filename: Original filename
            file_type: Type of file ('pdf' or 'image')
            file_size: Size of file in bytes
            
        Returns:
            Dict containing document data (id, user_id, filename, file_type, 
            file_size, storage_path, processing_status, created_at)
            
        Raises:
            Exception: If upload fails
            
        Requirements: 7.1
        """
        try:
            # Validate file type
            if file_type not in ['pdf', 'image']:
                raise ValueError(f"Invalid file type: {file_type}. Must be 'pdf' or 'image'")
            
            # Generate storage path
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            storage_path = f"documents/{user_id}/{timestamp}_{filename}"
            
            # Store file in Supabase Storage
            file_content = file.read()
            file.seek(0)  
            
            # Detect more specific content type
            content_type = "application/pdf" if file_type == "pdf" else "image/jpeg"
            if filename.lower().endswith('.png'): content_type = "image/png"
            if filename.lower().endswith('.webp'): content_type = "image/webp"

            storage_response = self.supabase.storage.from_('documents').upload(
                path=storage_path,
                file=file_content,
                file_options={"content-type": content_type}
            )
            
            # Check for upload failure (Supabase client might raise or return error depending on version)
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Storage upload failed: {storage_response.error}")
            
            # Create document record in database
            document_data = {
                "user_id": user_id,
                "filename": filename,
                "file_type": file_type,
                "file_size": file_size,
                "storage_path": storage_path,
                "processing_status": "pending"
            }
            
            response = self.supabase.table("documents").insert(document_data).execute()
            
            if not response.data or len(response.data) == 0:
                raise Exception("Failed to create document record")
            
            return response.data[0]
        except Exception as e:
            raise Exception(f"Failed to upload document: {str(e)}")
    
    async def process_pdf(self, document_id: str) -> Dict[str, Any]:
        """
        Process a PDF document: extract text, generate embeddings, and store them
        
        This is an async function that should be called as a background task.
        It extracts text from the PDF, chunks it, generates embeddings, and stores
        them in the database for semantic search.
        
        Args:
            document_id: Document's unique identifier
            
        Returns:
            Dict containing processing result with status and embedding count
            
        Raises:
            Exception: If processing fails
            
        Requirements: 7.2, 8.2, 8.4
        """
        try:
            # Get document record
            doc_response = self.supabase.table("documents")\
                .select("*")\
                .eq("id", document_id)\
                .execute()
            
            if not doc_response.data or len(doc_response.data) == 0:
                raise Exception("Document not found")
            
            document = doc_response.data[0]
            
            # Update status to processing
            self.supabase.table("documents")\
                .update({"processing_status": "processing"})\
                .eq("id", document_id)\
                .execute()
            
            # Download file from storage
            file_response = self.supabase.storage.from_('documents').download(document['storage_path'])
            
            # Extract text from PDF
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_response))
            full_text = ""
            
            for page_num, page in enumerate(pdf_reader.pages):
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
            
            if not full_text.strip():
                raise Exception("No text could be extracted from PDF")
            
            # Chunk the text (simple chunking by character count with overlap)
            chunk_size = 500  # characters per chunk
            chunk_overlap = 100  # overlap between chunks
            chunks = []
            
            start = 0
            chunk_index = 0
            while start < len(full_text):
                end = start + chunk_size
                chunk_text = full_text[start:end].strip()
                
                if chunk_text:
                    chunks.append({
                        "text": chunk_text,
                        "index": chunk_index
                    })
                    chunk_index += 1
                
                start = end - chunk_overlap
            
            # Generate embeddings for all chunks
            embeddings_data = []
            for chunk in chunks:
                embedding_vector = await self.generate_embeddings(chunk["text"])
                
                embeddings_data.append({
                    "document_id": document_id,
                    "chunk_text": chunk["text"],
                    "chunk_index": chunk["index"],
                    "embedding": embedding_vector
                })
            
            # Store embeddings in database (batch insert)
            if embeddings_data:
                self.supabase.table("embeddings").insert(embeddings_data).execute()
            
            # Generate High-Yield Summary
            summary_prompt = f"""Generate a high-yield clinical summary of this medical document.
Include:
1. Document Type & Context
2. Key Clinical Findings/Data points
3. Relevant Pathophysiology or Management mentioned
4. Recommended study focus areas

Text: {full_text[:6000]}""" # Limit to first 6000 chars for summary

            summary_result = await self.model_router.execute_with_fallback(
                provider="gemini",
                feature="explain",
                prompt=summary_prompt,
                user_id=document["user_id"]
            )
            
            if summary_result["success"]:
                summary_text = summary_result["content"]
                summary_embedding = await self.generate_embeddings(summary_text)
                
                # Store summary with chunk_index = -1 (Special marker for Intelligence)
                self.supabase.table("embeddings").insert({
                    "document_id": document_id,
                    "chunk_text": f"High-Yield Summary of {document['filename']}:\n{summary_text}",
                    "chunk_index": -1,
                    "embedding": summary_embedding
                }).execute()
            
            # Update document status to completed
            self.supabase.table("documents")\
                .update({"processing_status": "completed"})\
                .eq("id", document_id)\
                .execute()
            
            return {
                "status": "completed",
                "document_id": document_id,
                "chunks_processed": len(embeddings_data)
            }
        except Exception as e:
            # Update document status to failed
            try:
                self.supabase.table("documents")\
                    .update({"processing_status": "failed"})\
                    .eq("id", document_id)\
                    .execute()
            except:
                pass
            
            raise Exception(f"Failed to process PDF: {str(e)}")

    async def process_image(self, document_id: str) -> Dict[str, Any]:
        """
        Process a medical image: analyze content using AI and store interpretation
        
        Requirements: 13.0
        """
        try:
            # Get document record
            doc_response = self.supabase.table("documents")\
                .select("*")\
                .eq("id", document_id)\
                .execute()
            
            if not doc_response.data or len(doc_response.data) == 0:
                raise Exception("Document not found")
            
            document = doc_response.data[0]
            
            # Update status to processing
            self.supabase.table("documents")\
                .update({"processing_status": "processing"})\
                .eq("id", document_id)\
                .execute()
            
            # Download file from storage
            file_response = self.supabase.storage.from_('documents').download(document['storage_path'])
            
            # Encode image to base64 for AI processing
            image_base64 = base64.b64encode(file_response).decode('utf-8')
            
            # Prepare clinical analysis prompt
            prompt = """Analyze this medical image (it could be an X-ray, CT, ECG, or pathology slide).
Provide a structured clinical interpretation including:
1. Image Type & View
2. Key Findings
3. Likely Differentials
4. Clinical Recommendations

Keep the analysis professional and concise."""

            # Use Model Router for image analysis
            # Ensure we are using a vision-capable provider
            result = await self.model_router.execute_with_fallback(
                provider="gemini", # Gemini 1.5 is excellent for medical vision
                feature="image",
                prompt=prompt,
                user_id=document["user_id"],
                image_data=image_base64 # Match ModelRouter parameter name
            )
            
            if not result["success"]:
                raise Exception(f"AI Analysis failed: {result.get('error')}")
            
            interpretation = result["content"]
            
            # Store interpretation as 1. Metadata or 2. In a special column?
            # For now, let's just store it in a way that can be searched or displayed.
            # We can create a chunk and embedding for the interpretation too!
            
            # Generate embedding for the interpretation
            embedding_vector = await self.generate_embeddings(interpretation)
            
            # Store as an embedding record with chunk_index = -1 (Special marker for Intelligence)
            embedding_data = {
                "document_id": document_id,
                "chunk_text": f"AI Interpretation of {document['filename']}:\n{interpretation}",
                "chunk_index": -1,
                "embedding": embedding_vector
            }
            
            self.supabase.table("embeddings").insert(embedding_data).execute()
            
            # Update document status to completed
            self.supabase.table("documents")\
                .update({"processing_status": "completed"})\
                .eq("id", document_id)\
                .execute()
            
            return {
                "status": "completed",
                "document_id": document_id,
                "interpretation": interpretation
            }
        except Exception as e:
            # Update document status to failed
            try:
                self.supabase.table("documents")\
                    .update({"processing_status": "failed"})\
                    .eq("id", document_id)\
                    .execute()
            except:
                pass
            
            raise Exception(f"Failed to process Image: {str(e)}")
    
    async def generate_embeddings(self, text: str) -> List[float]:
        """
        Generate embeddings for a text string using the embedding model
        
        Args:
            text: Text to generate embeddings for
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            Exception: If embedding generation fails
            
        Requirements: 7.2, 8.2
        """
        try:
            # Generate embedding using sentence-transformers
            embedding = self.embedding_model.encode(text, convert_to_numpy=True)
            
            # Convert numpy array to list of floats
            return embedding.tolist()
        except Exception as e:
            raise Exception(f"Failed to generate embeddings: {str(e)}")
    
    async def semantic_search(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
        document_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search across user's documents using pgvector
        
        Args:
            user_id: User's unique identifier
            query: Search query text
            top_k: Number of top results to return (default 5)
            document_id: Optional specific document to search within
            
        Returns:
            List of dictionaries containing chunk_text, document info, and similarity score,
            ordered by similarity (most relevant first)
            
        Raises:
            Exception: If search fails
            
        Requirements: 8.5
        """
        try:
            # Generate embedding for the query
            query_embedding = await self.generate_embeddings(query)
            
            # Perform vector similarity search using pgvector
            # Using cosine similarity (1 - cosine_distance)
            # Note: Supabase Python client doesn't have direct vector search support yet,
            # so we use RPC to call a custom PostgreSQL function
            
            # Build query for documents
            docs_query = self.supabase.table("documents")\
                .select("id")\
                .eq("user_id", user_id)\
                .eq("processing_status", "completed")
            
            # Filter by specific document if provided
            if document_id:
                docs_query = docs_query.eq("id", document_id)
            
            docs_response = docs_query.execute()
            
            if not docs_response.data or len(docs_response.data) == 0:
                return []
            
            document_ids = [doc['id'] for doc in docs_response.data]
            
            # Get embeddings for user's documents and calculate similarity
            # Exclude summary chunks (chunk_index = -1) from search
            embeddings_response = self.supabase.table("embeddings")\
                .select("id, document_id, chunk_text, chunk_index, embedding")\
                .in_("document_id", document_ids)\
                .neq("chunk_index", -1)\
                .execute()
            
            if not embeddings_response.data or len(embeddings_response.data) == 0:
                return []
            
            # Calculate cosine similarity for each embedding
            results = []
            query_vector = np.array(query_embedding, dtype=np.float32)
            
            for emb in embeddings_response.data:
                # Handle embedding conversion - it might be stored as string or list
                try:
                    embedding_data = emb['embedding']
                    if isinstance(embedding_data, str):
                        # Parse string representation of array
                        import json
                        chunk_vector = np.array(json.loads(embedding_data), dtype=np.float32)
                    elif isinstance(embedding_data, list):
                        chunk_vector = np.array(embedding_data, dtype=np.float32)
                    else:
                        chunk_vector = np.array(embedding_data, dtype=np.float32)
                except (json.JSONDecodeError, ValueError, TypeError) as e:
                    print(f"Warning: Skipping invalid embedding for chunk {emb.get('id')}: {str(e)}")
                    continue
                
                # Ensure both vectors have the same shape
                if query_vector.shape != chunk_vector.shape:
                    print(f"Warning: Shape mismatch - query: {query_vector.shape}, chunk: {chunk_vector.shape}")
                    continue
                
                # Calculate cosine similarity
                try:
                    similarity = np.dot(query_vector, chunk_vector) / (
                        np.linalg.norm(query_vector) * np.linalg.norm(chunk_vector)
                    )
                except Exception as calc_err:
                    print(f"Warning: Failed to calculate similarity: {str(calc_err)}")
                    continue
                
                # Get document info
                doc_response = self.supabase.table("documents")\
                    .select("filename, file_type")\
                    .eq("id", emb['document_id'])\
                    .execute()
                
                doc_info = doc_response.data[0] if doc_response.data else {}
                
                results.append({
                    "chunk_text": emb['chunk_text'],
                    "chunk_index": emb['chunk_index'],
                    "document_id": emb['document_id'],
                    "document_filename": doc_info.get('filename', 'Unknown'),
                    "similarity_score": float(similarity)
                })
            
            # Sort by similarity score (descending) and return top_k
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return results[:top_k]
        except Exception as e:
            raise Exception(f"Failed to perform semantic search: {str(e)}")
    
    async def get_document_intelligence(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """
        Retrieve the AI-generated intelligence (summary/interpretation) for a document
        """
        try:
            # Verify ownership
            doc_res = self.supabase.table("documents").select("filename, file_type").eq("id", document_id).eq("user_id", user_id).execute()
            if not doc_res.data:
                raise Exception("Unauthorized or document not found")
            
            # Get the summary/interpretation (chunk_index = -1)
            emb_res = self.supabase.table("embeddings")\
                .select("chunk_text")\
                .eq("document_id", document_id)\
                .eq("chunk_index", -1)\
                .execute()
            
            if not emb_res.data:
                return {"intelligence": "Intelligence not yet ready or processing failed."}
            
            return {
                "id": document_id,
                "filename": doc_res.data[0]["filename"],
                "file_type": doc_res.data[0]["file_type"],
                "intelligence": emb_res.data[0]["chunk_text"]
            }
        except Exception as e:
            raise Exception(f"Failed to retrieve intelligence: {str(e)}")

    async def get_user_documents(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all documents for a user
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            List of document dictionaries ordered by created_at descending
            
        Raises:
            Exception: If retrieval fails
            
        Requirements: 7.1
        """
        try:
            response = self.supabase.table("documents")\
                .select("*")\
                .eq("user_id", user_id)\
                .order("created_at", desc=True)\
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            raise Exception(f"Failed to get user documents: {str(e)}")
    
    async def delete_document(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """
        Delete a document and its associated embeddings
        
        Args:
            document_id: Document's unique identifier
            user_id: User's unique identifier (for authorization)
            
        Returns:
            Dict containing deletion confirmation
            
        Raises:
            Exception: If deletion fails or document doesn't belong to user
            
        Requirements: 7.1
        """
        try:
            # Verify document belongs to user
            doc_response = self.supabase.table("documents")\
                .select("id, storage_path")\
                .eq("id", document_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not doc_response.data or len(doc_response.data) == 0:
                raise Exception("Document not found or does not belong to user")
            
            document = doc_response.data[0]
            
            # Delete embeddings (CASCADE should handle this, but explicit is better)
            self.supabase.table("embeddings")\
                .delete()\
                .eq("document_id", document_id)\
                .execute()
            
            # Delete file from storage
            try:
                self.supabase.storage.from_('documents').remove([document['storage_path']])
            except:
                # Continue even if storage deletion fails
                pass
            
            # Delete document record
            self.supabase.table("documents")\
                .delete()\
                .eq("id", document_id)\
                .execute()
            
            return {
                "success": True,
                "document_id": document_id,
                "message": "Document deleted successfully"
            }
        except Exception as e:
            raise Exception(f"Failed to delete document: {str(e)}")


# Singleton instance for easy import
_document_service_instance = None


def get_document_service(supabase_client: Optional[Client] = None, model_router=None) -> DocumentService:
    """
    Get or create the document service instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        model_router: Optional model router service
        
    Returns:
        DocumentService instance
    """
    global _document_service_instance
    if _document_service_instance is None or supabase_client is not None:
        _document_service_instance = DocumentService(supabase_client, model_router)
    return _document_service_instance
