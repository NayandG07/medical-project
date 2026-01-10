"""
Chat Service
Handles chat session management and message persistence
Requirements: 3.2, 3.4, 9.1
"""
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from supabase import Client, create_client
from dotenv import load_dotenv
from services.rate_limiter import get_rate_limiter

# Load environment variables
load_dotenv()


class ChatService:
    """Chat service for managing chat sessions and messages"""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize the chat service
        
        Args:
            supabase_client: Optional Supabase client for dependency injection
        """
        if supabase_client:
            self.supabase = supabase_client
        else:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
            self.supabase = create_client(supabase_url, supabase_key)
    
    async def create_session(self, user_id: str, title: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new chat session for a user
        
        Args:
            user_id: User's unique identifier
            title: Optional title for the chat session
            
        Returns:
            Dict containing session data (id, user_id, title, created_at, updated_at)
            
        Raises:
            Exception: If session creation fails
            
        Requirements: 3.2
        """
        try:
            session_data = {
                "user_id": user_id,
                "title": title
            }
            
            response = self.supabase.table("chat_sessions").insert(session_data).execute()
            
            if not response.data or len(response.data) == 0:
                raise Exception("Failed to create chat session")
            
            return response.data[0]
        except Exception as e:
            raise Exception(f"Failed to create session: {str(e)}")
    
    async def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all chat sessions for a user
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            List of session dictionaries ordered by updated_at descending
            
        Raises:
            Exception: If retrieval fails
            
        Requirements: 3.2
        """
        try:
            response = self.supabase.table("chat_sessions")\
                .select("*")\
                .eq("user_id", user_id)\
                .order("updated_at", desc=True)\
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            raise Exception(f"Failed to get user sessions: {str(e)}")

    async def delete_session(self, user_id: str, session_id: str) -> None:
        """
        Delete a chat session
        
        Args:
            user_id: User's unique identifier
            session_id: Session identifier
            
        Raises:
            Exception: If deletion fails
        """
        try:
            # First verify ownership
            session_response = self.supabase.table("chat_sessions")\
                .select("id")\
                .eq("id", session_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not session_response.data or len(session_response.data) == 0:
                raise Exception("Session not found or does not belong to user")
            
            # Delete messages first (if no cascade delete on DB)
            self.supabase.table("messages").delete().eq("session_id", session_id).execute()
            
            # Delete session
            self.supabase.table("chat_sessions").delete().eq("id", session_id).execute()
            
        except Exception as e:
            raise Exception(f"Failed to delete session: {str(e)}")
    
    async def send_message(
        self, 
        user_id: str, 
        session_id: str, 
        message: str,
        role: str = "user",
        tokens_used: int = 0,
        generate_response: bool = True
    ) -> Dict[str, Any]:
        """
        Send a message in a chat session and optionally generate AI response
        
        Integrates with model router to generate AI responses using available providers.
        Detects and routes slash commands to appropriate handlers.
        
        Args:
            user_id: User's unique identifier
            session_id: Chat session identifier
            message: Message content
            role: Message role (user, assistant, system)
            tokens_used: Number of tokens used for this message (default 0 for user messages)
            generate_response: Whether to generate an AI response (default True)
            
        Returns:
            Dict containing the stored message data (user message if generate_response=False,
            assistant message if generate_response=True)
            
        Raises:
            Exception: If message storage or AI generation fails
            
        Requirements: 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 21.1
        """
        try:
            # Verify session belongs to user
            session_response = self.supabase.table("chat_sessions")\
                .select("id")\
                .eq("id", session_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not session_response.data or len(session_response.data) == 0:
                raise Exception("Session not found or does not belong to user")
            
            # Store user message in database with timestamp
            user_message_data = {
                "session_id": session_id,
                "role": role,
                "content": message,
                "tokens_used": tokens_used if tokens_used > 0 else None,
                "citations": None
            }
            
            user_message_response = self.supabase.table("messages").insert(user_message_data).execute()
            
            if not user_message_response.data or len(user_message_response.data) == 0:
                raise Exception("Failed to store user message")
            
            # If not generating response, return user message
            if not generate_response:
                # Update session's updated_at timestamp
                self.supabase.table("chat_sessions")\
                    .update({"updated_at": datetime.now(timezone.utc).isoformat()})\
                    .eq("id", session_id)\
                    .execute()
                
                return user_message_response.data[0]
            
            # Check if message is a slash command (Requirements 4.1-4.5)
            from services.commands import get_command_service
            
            command_service = get_command_service(self.supabase)
            parsed_command = command_service.parse_command(message)
            
            if parsed_command:
                # Execute the command
                command_result = await command_service.execute_command(
                    user_id=user_id,
                    command=parsed_command['command'],
                    topic=parsed_command['topic']
                )
                
                # Store command result as assistant message
                ai_message_data = {
                    "session_id": session_id,
                    "role": "assistant",
                    "content": command_result["content"],
                    "tokens_used": command_result["tokens_used"],
                    "citations": None
                }
                
                ai_message_response = self.supabase.table("messages").insert(ai_message_data).execute()
                
                if not ai_message_response.data or len(ai_message_response.data) == 0:
                    raise Exception("Failed to store command result")
                
                # Update session's updated_at timestamp
                self.supabase.table("chat_sessions")\
                    .update({"updated_at": datetime.now(timezone.utc).isoformat()})\
                    .eq("id", session_id)\
                    .execute()
                
                # Return the command result message
                return ai_message_response.data[0]
            
            # Not a command, generate regular AI response using model router (Requirement 21.1)
            from services.model_router import get_model_router_service
            from services.documents import get_document_service
            
            router = get_model_router_service(self.supabase)
            
            # Check if user has documents for RAG (Requirements 8.1, 8.3)
            doc_service = get_document_service(self.supabase)
            user_documents = await doc_service.get_user_documents(user_id)
            
            # Filter for completed documents only
            completed_docs = [doc for doc in user_documents if doc.get('processing_status') == 'completed']
            
            # Prepare prompt with RAG context if documents exist
            final_prompt = message
            citations = None
            
            if completed_docs:
                # Perform semantic search to find relevant document chunks
                search_results = await doc_service.semantic_search(
                    user_id=user_id,
                    query=message,
                    top_k=3  # Get top 3 most relevant chunks
                )
                
                if search_results:
                    # Build context from search results
                    context_parts = []
                    citation_list = []
                    
                    for idx, result in enumerate(search_results, 1):
                        context_parts.append(
                            f"[Source {idx}: {result['document_filename']}]\n{result['chunk_text']}"
                        )
                        citation_list.append({
                            "source_number": idx,
                            "document_id": result['document_id'],
                            "document_filename": result['document_filename'],
                            "chunk_index": result['chunk_index'],
                            "similarity_score": result['similarity_score']
                        })
                    
                    # Combine context with user query
                    context_text = "\n\n".join(context_parts)
                    final_prompt = f"""Based on the following context from the user's documents, please answer their question. Include citations to the sources when relevant.

Context:
{context_text}

User Question: {message}

Please provide a comprehensive answer based on the context above, and cite your sources using [Source N] notation."""
                    
                    # Store citations for the response
                    citations = {"sources": citation_list}
            
            # Select provider for chat feature
            provider = await router.select_provider("chat")
            
            # Execute request with automatic fallback (Requirement 3.3)
            ai_result = await router.execute_with_fallback(
                provider=provider,
                feature="chat",
                prompt=final_prompt,
                system_prompt="""You are VaidyaAI, a specialized medical education AI tutor designed for MBBS students and medical professionals. Your role is to:

1. Provide accurate, evidence-based medical information aligned with current clinical guidelines
2. Help students understand complex medical concepts by bridging basic science with clinical application
3. Support preparation for medical licensing exams (USMLE, NEET-PG, etc.)
4. Emphasize clinical reasoning and diagnostic thinking
5. Use standard medical terminology with clear explanations when needed
6. Ground responses in evidence-based medicine and current best practices
7. When context from documents is provided, use it to ground your responses and cite sources appropriately

Focus on:
- Clinical relevance and real-world application
- Pathophysiology and mechanisms of disease
- Diagnostic approaches and clinical decision-making
- Evidence-based treatment and management
- Key information for medical exams and clinical practice
- Patient safety and ethical considerations

Always prioritize accuracy, clarity, and clinical applicability in your responses."""
            )
            
            if not ai_result["success"]:
                # AI generation failed, return error
                raise Exception(f"AI response generation failed: {ai_result.get('error', 'Unknown error')}")
            
            # Store AI response message with citations if available (Requirement 8.3)
            ai_message_data = {
                "session_id": session_id,
                "role": "assistant",
                "content": ai_result["content"],
                "tokens_used": ai_result["tokens_used"],
                "citations": citations  # Include citations from RAG
            }
            
            ai_message_response = self.supabase.table("messages").insert(ai_message_data).execute()
            
            if not ai_message_response.data or len(ai_message_response.data) == 0:
                raise Exception("Failed to store AI message")
            
            # Update session's updated_at timestamp
            self.supabase.table("chat_sessions")\
                .update({"updated_at": datetime.now(timezone.utc).isoformat()})\
                .eq("id", session_id)\
                .execute()
            
            # Track usage after successful message storage (Requirement 9.1)
            rate_limiter = get_rate_limiter(self.supabase)
            await rate_limiter.increment_usage(
                user_id=user_id,
                tokens=ai_result["tokens_used"],
                feature="chat"
            )
            
            # Return the AI response message
            return ai_message_response.data[0]
        except Exception as e:
            raise Exception(f"Failed to send message: {str(e)}")
    
    async def get_chat_history(self, user_id: str, session_id: str) -> List[Dict[str, Any]]:
        """
        Get chat history for a specific session
        
        Args:
            user_id: User's unique identifier
            session_id: Chat session identifier
            
        Returns:
            List of message dictionaries ordered by created_at ascending
            
        Raises:
            Exception: If retrieval fails or session doesn't belong to user
            
        Requirements: 3.4
        """
        try:
            # Verify session belongs to user
            session_response = self.supabase.table("chat_sessions")\
                .select("id")\
                .eq("id", session_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not session_response.data or len(session_response.data) == 0:
                raise Exception("Session not found or does not belong to user")
            
            # Get messages ordered by creation time
            response = self.supabase.table("messages")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("created_at", desc=False)\
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            raise Exception(f"Failed to get chat history: {str(e)}")


# Singleton instance for easy import
_chat_service_instance = None


def get_chat_service(supabase_client: Optional[Client] = None) -> ChatService:
    """
    Get or create the chat service instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        
    Returns:
        ChatService instance
    """
    global _chat_service_instance
    if _chat_service_instance is None or supabase_client is not None:
        _chat_service_instance = ChatService(supabase_client)
    return _chat_service_instance
