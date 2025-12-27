"""
Maintenance Middleware

Checks maintenance status before processing requests and enforces maintenance mode rules.
Requirements: 12.5, 12.6
"""
import os
import logging
from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from supabase import Client, create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class MaintenanceMiddleware:
    """Middleware for checking and enforcing maintenance mode"""
    
    # Heavy features that are blocked in soft maintenance
    HEAVY_FEATURES = [
        "/api/documents",  # PDF processing
        "/api/images",     # Image analysis
    ]
    
    # Admin routes that are always allowed
    ADMIN_ROUTES = [
        "/api/admin",
        "/api/health",
    ]
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize maintenance middleware
        
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
    
    async def get_maintenance_status(self) -> dict:
        """
        Get current maintenance status from database
        
        Returns:
            Dict with maintenance status information
        """
        try:
            # Query system_flags table
            flag_name = "maintenance_mode"
            result = self.supabase.table("system_flags") \
                .select("flag_value, updated_at") \
                .eq("flag_name", flag_name) \
                .execute()
            
            if not result.data:
                # No maintenance flag exists
                return {
                    "in_maintenance": False,
                    "level": None,
                    "reason": None,
                }
            
            # Parse flag value
            import ast
            try:
                flag_value = ast.literal_eval(result.data[0]["flag_value"])
                
                # Check if maintenance is active
                is_active = flag_value.get("is_active", False)
                
                if not is_active:
                    return {
                        "in_maintenance": False,
                        "level": None,
                        "reason": None,
                    }
                
                return {
                    "in_maintenance": True,
                    "level": flag_value.get("level"),
                    "reason": flag_value.get("reason"),
                }
            except Exception as e:
                logger.error(f"Failed to parse maintenance flag: {str(e)}")
                return {
                    "in_maintenance": False,
                    "level": None,
                    "reason": None,
                }
        except Exception as e:
            logger.error(f"Failed to get maintenance status: {str(e)}")
            return {
                "in_maintenance": False,
                "level": None,
                "reason": None,
            }
    
    async def is_admin_user(self, user_id: str) -> bool:
        """
        Check if a user is an admin
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            True if user is admin, False otherwise
        """
        try:
            # Get user email and role
            user_response = self.supabase.table("users").select("email, role").eq("id", user_id).execute()
            
            if not user_response.data or len(user_response.data) == 0:
                return False
            
            user_email = user_response.data[0]["email"]
            user_role = user_response.data[0].get("role")
            
            # Check SUPER_ADMIN_EMAIL environment variable
            super_admin_email = os.getenv("SUPER_ADMIN_EMAIL")
            if super_admin_email and user_email == super_admin_email:
                return True
            
            # Check admin_allowlist table
            allowlist_response = self.supabase.table("admin_allowlist")\
                .select("role")\
                .eq("email", user_email)\
                .execute()
            
            if allowlist_response.data and len(allowlist_response.data) > 0:
                allowlist_role = allowlist_response.data[0]["role"]
                # User must be in allowlist AND have a role
                if allowlist_role and user_role:
                    return True
            
            return False
        except Exception as e:
            logger.error(f"Error checking admin status: {str(e)}")
            return False
    
    def is_heavy_feature(self, path: str) -> bool:
        """
        Check if a request path is for a heavy feature
        
        Args:
            path: Request path
            
        Returns:
            True if path is for a heavy feature, False otherwise
        """
        for heavy_path in self.HEAVY_FEATURES:
            if path.startswith(heavy_path):
                return True
        return False
    
    def is_admin_route(self, path: str) -> bool:
        """
        Check if a request path is an admin route
        
        Args:
            path: Request path
            
        Returns:
            True if path is an admin route, False otherwise
        """
        for admin_path in self.ADMIN_ROUTES:
            if path.startswith(admin_path):
                return True
        return False
    
    async def check_maintenance(self, request: Request, user_id: Optional[str] = None) -> None:
        """
        Check maintenance status and enforce maintenance mode rules
        
        Requirements:
        - 12.5: Soft maintenance blocks heavy features, allows chat and admin
        - 12.6: Hard maintenance blocks all except admin
        
        Args:
            request: FastAPI request object
            user_id: Optional user ID for admin check
            
        Raises:
            HTTPException: 503 Service Unavailable if request is blocked by maintenance mode
        """
        # Get current maintenance status
        maintenance_status = await self.get_maintenance_status()
        
        # If not in maintenance, allow all requests
        if not maintenance_status["in_maintenance"]:
            return
        
        level = maintenance_status["level"]
        reason = maintenance_status["reason"]
        path = request.url.path
        
        # Admin routes are always allowed
        if self.is_admin_route(path):
            return
        
        # Check if user is admin
        is_admin = False
        if user_id:
            is_admin = await self.is_admin_user(user_id)
        
        # Soft maintenance mode (Requirement 12.5)
        if level == "soft":
            # Block heavy features
            if self.is_heavy_feature(path):
                logger.warning(f"Blocking heavy feature request during soft maintenance: {path}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={
                        "error": {
                            "code": "MAINTENANCE_MODE",
                            "message": f"This feature is temporarily unavailable due to maintenance: {reason}",
                            "maintenance": {
                                "level": "soft",
                                "reason": reason,
                                "blocked_feature": "heavy_processing"
                            }
                        }
                    }
                )
            
            # Allow chat and other light features
            # Allow admin users
            return
        
        # Hard maintenance mode (Requirement 12.6)
        elif level == "hard":
            # Only allow admin users
            if not is_admin:
                logger.warning(f"Blocking non-admin request during hard maintenance: {path}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={
                        "error": {
                            "code": "MAINTENANCE_MODE",
                            "message": f"The system is currently under maintenance: {reason}. Please try again later.",
                            "maintenance": {
                                "level": "hard",
                                "reason": reason,
                                "admin_only": True
                            }
                        }
                    }
                )
            
            # Allow admin users
            return


# Singleton instance
_maintenance_middleware_instance: Optional[MaintenanceMiddleware] = None


def get_maintenance_middleware(supabase_client: Optional[Client] = None) -> MaintenanceMiddleware:
    """
    Get or create maintenance middleware instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        
    Returns:
        MaintenanceMiddleware instance
    """
    global _maintenance_middleware_instance
    if _maintenance_middleware_instance is None or supabase_client is not None:
        _maintenance_middleware_instance = MaintenanceMiddleware(supabase_client)
    return _maintenance_middleware_instance
