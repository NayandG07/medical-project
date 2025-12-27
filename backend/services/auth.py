"""
Authentication Service
Handles user authentication, registration, and admin verification
Requirements: 1.1, 1.2, 1.3, 2.2, 2.4, 27.1, 27.3, 27.5
"""
import os
from typing import Optional, Dict, Any
from supabase import Client, create_client
from dotenv import load_dotenv
from services.encryption import encrypt_key, decrypt_key

# Load environment variables
load_dotenv()


class AuthService:
    """Authentication service for user management and admin verification"""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize the authentication service
        
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
    
    async def authenticate_user(self, email: str, password: str) -> Dict[str, Any]:
        """
        Authenticate a user with email and password
        
        Args:
            email: User's email address
            password: User's password
            
        Returns:
            Dict containing user data and session information
            
        Raises:
            Exception: If authentication fails
            
        Requirements: 1.1
        """
        try:
            response = self.supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if not response.user:
                raise Exception("Authentication failed")
            
            return {
                "user": response.user,
                "session": response.session
            }
        except Exception as e:
            raise Exception(f"Authentication failed: {str(e)}")
    
    async def register_user(self, email: str, password: str, name: str) -> Dict[str, Any]:
        """
        Register a new user with default "free" plan
        
        Args:
            email: User's email address
            password: User's password
            name: User's full name
            
        Returns:
            Dict containing user data
            
        Requirements: 1.2
        """
        try:
            # Create auth user
            auth_response = self.supabase.auth.sign_up({
                "email": email,
                "password": password
            })
            
            if not auth_response.user:
                raise Exception("User registration failed")
            
            user_id = auth_response.user.id
            
            # Create user record with default "free" plan
            user_data = {
                "id": user_id,
                "email": email,
                "name": name,
                "plan": "free",  # Default plan as per requirement 1.2
                "role": None,
                "disabled": False
            }
            
            # Insert user record into users table
            self.supabase.table("users").insert(user_data).execute()
            
            return {
                "user": auth_response.user,
                "session": auth_response.session,
                "plan": "free"
            }
        except Exception as e:
            raise Exception(f"Registration failed: {str(e)}")
    
    async def get_user_plan(self, user_id: str) -> str:
        """
        Get the plan for a specific user
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            User's plan (free, student, pro, admin)
            
        Requirements: 1.3
        """
        try:
            response = self.supabase.table("users").select("plan").eq("id", user_id).execute()
            
            if not response.data or len(response.data) == 0:
                raise Exception("User not found")
            
            return response.data[0]["plan"]
        except Exception as e:
            raise Exception(f"Failed to get user plan: {str(e)}")
    
    async def verify_admin(self, user_id: str) -> Optional[str]:
        """
        Verify if a user is an admin and return their role
        Checks admin_allowlist table for email and role
        Includes emergency admin check via SUPER_ADMIN_EMAIL environment variable
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            Admin role if user is admin, None otherwise
            
        Requirements: 2.2, 2.4
        """
        try:
            # Get user email
            user_response = self.supabase.table("users").select("email, role").eq("id", user_id).execute()
            
            if not user_response.data or len(user_response.data) == 0:
                return None
            
            user_email = user_response.data[0]["email"]
            user_role = user_response.data[0].get("role")
            
            # Emergency admin check via SUPER_ADMIN_EMAIL (Requirement 2.4)
            super_admin_email = os.getenv("SUPER_ADMIN_EMAIL")
            if super_admin_email and user_email == super_admin_email:
                return "super_admin"
            
            # Check admin_allowlist table (Requirement 2.2)
            allowlist_response = self.supabase.table("admin_allowlist").select("role").eq("email", user_email).execute()
            
            if allowlist_response.data and len(allowlist_response.data) > 0:
                allowlist_role = allowlist_response.data[0]["role"]
                # User must be in allowlist AND have role that permits access
                if allowlist_role and user_role:
                    return allowlist_role
            
            return None
        except Exception as e:
            # Log error but don't expose details
            print(f"Admin verification error: {str(e)}")
            return None
    
    async def set_user_api_key(self, user_id: str, key: str) -> Dict[str, Any]:
        """
        Set or update a user's personal API key
        Encrypts the key before storage and validates it
        
        Args:
            user_id: User's unique identifier
            key: Plaintext API key to store
            
        Returns:
            Dict with success status and message
            
        Raises:
            Exception: If validation or storage fails
            
        Requirements: 27.1, 27.3, 27.5
        """
        try:
            # Validate key is not empty
            if not key or len(key.strip()) == 0:
                raise Exception("API key cannot be empty")
            
            # Validate key format (basic validation)
            if len(key) < 10:
                raise Exception("API key appears to be invalid (too short)")
            
            # Encrypt the key before storage (Requirement 27.1)
            encrypted_key = encrypt_key(key)
            
            # Update user record with encrypted personal API key
            self.supabase.table("users").update({
                "personal_api_key": encrypted_key
            }).eq("id", user_id).execute()
            
            return {
                "success": True,
                "message": "Personal API key stored successfully"
            }
        except Exception as e:
            raise Exception(f"Failed to set user API key: {str(e)}")
    
    async def get_user_api_key(self, user_id: str) -> Optional[str]:
        """
        Get a user's personal API key (decrypted)
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            Decrypted API key if set, None otherwise
            
        Raises:
            Exception: If retrieval or decryption fails
            
        Requirements: 27.1, 27.5
        """
        try:
            # Get user record
            response = self.supabase.table("users").select("personal_api_key").eq("id", user_id).execute()
            
            if not response.data or len(response.data) == 0:
                raise Exception("User not found")
            
            encrypted_key = response.data[0].get("personal_api_key")
            
            # Return None if no key is set
            if not encrypted_key:
                return None
            
            # Decrypt and return the key
            decrypted_key = decrypt_key(encrypted_key)
            return decrypted_key
            
        except Exception as e:
            raise Exception(f"Failed to get user API key: {str(e)}")
    
    async def remove_user_api_key(self, user_id: str) -> Dict[str, Any]:
        """
        Remove a user's personal API key
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            Dict with success status and message
            
        Raises:
            Exception: If removal fails
            
        Requirements: 27.5
        """
        try:
            # Update user record to remove personal API key
            self.supabase.table("users").update({
                "personal_api_key": None
            }).eq("id", user_id).execute()
            
            return {
                "success": True,
                "message": "Personal API key removed successfully"
            }
        except Exception as e:
            raise Exception(f"Failed to remove user API key: {str(e)}")


# Singleton instance for easy import
_auth_service_instance = None


def get_auth_service(supabase_client: Optional[Client] = None) -> AuthService:
    """
    Get or create the authentication service instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        
    Returns:
        AuthService instance
    """
    global _auth_service_instance
    if _auth_service_instance is None or supabase_client is not None:
        _auth_service_instance = AuthService(supabase_client)
    return _auth_service_instance
