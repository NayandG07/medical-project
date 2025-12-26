"""
Chat Service
Handles chat session management and message persistence
Requirements: 3.2, 3.4
"""
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from supabase import Client, create_client
from dotenv import load_dotenv

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
    
    async def send_message(
        self, 
        user_id: str, 
        session_id: str, 
        message: str,
        role: str = "user"
    ) -> Dict[str, Any]:
        """
        Send a message in a chat session (stub for now)
        
        This is a stub implementation that stores the user message.
        Future implementations will integrate with model router for AI responses.
        
        Args:
            user_id: User's unique identifier
            session_id: Chat session identifier
            message: Message content
            role: Message role (user, assistant, system)
            
        Returns:
            Dict containing the stored message data
            
        Raises:
            Exception: If message storage fails
            
        Requirements: 3.2, 3.4
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
            
            # Store message in database with timestamp
            message_data = {
                "session_id": session_id,
                "role": role,
                "content": message,
                "tokens_used": None,  # Will be set when AI integration is added
                "citations": None
            }
            
            response = self.supabase.table("messages").insert(message_data).execute()
            
            if not response.data or len(response.data) == 0:
                raise Exception("Failed to store message")
            
            # Update session's updated_at timestamp
            self.supabase.table("chat_sessions")\
                .update({"updated_at": datetime.now(timezone.utc).isoformat()})\
                .eq("id", session_id)\
                .execute()
            
            return response.data[0]
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
