"""
Feature Toggle Middleware

Checks feature status before processing feature-specific requests and enforces feature toggles.
Requirements: 16.3
"""
import os
import logging
from typing import Optional
from fastapi import Request, HTTPException, status
from supabase import Client, create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class FeatureToggleMiddleware:
    """Middleware for checking and enforcing feature toggles"""
    
    # Map of route prefixes to feature names
    FEATURE_ROUTES = {
        "/api/chat": "chat",
        "/api/commands/flashcard": "flashcard",
        "/api/commands/mcq": "mcq",
        "/api/commands/highyield": "highyield",
        "/api/commands/explain": "explain",
        "/api/commands/map": "map",
        "/api/documents": "pdf",
        "/api/images": "image",
    }
    
    # Routes that should not be checked (always allowed)
    EXEMPT_ROUTES = [
        "/api/health",
        "/api/auth",
        "/api/admin",
    ]
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize feature toggle middleware
        
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
    
    async def get_feature_status(self, feature: str) -> bool:
        """
        Get the enabled status of a specific feature
        
        Args:
            feature: Feature name to check
            
        Returns:
            True if feature is enabled, False if disabled
        """
        try:
            # Create flag name
            flag_name = f"feature_{feature}_enabled"
            
            # Query system_flags table
            result = self.supabase.table("system_flags") \
                .select("flag_value") \
                .eq("flag_name", flag_name) \
                .execute()
            
            if not result.data:
                # Feature flag doesn't exist, default to enabled
                return True
            
            # Parse flag value
            flag_value = result.data[0]["flag_value"]
            
            # Convert string to boolean
            return flag_value.lower() == "true"
        except Exception as e:
            logger.error(f"Failed to get feature status for {feature}: {str(e)}")
            # Default to enabled on error to avoid blocking legitimate requests
            return True
    
    def get_feature_from_path(self, path: str) -> Optional[str]:
        """
        Extract feature name from request path
        
        Args:
            path: Request path
            
        Returns:
            Feature name if path matches a feature route, None otherwise
        """
        # Check each feature route
        for route_prefix, feature_name in self.FEATURE_ROUTES.items():
            if path.startswith(route_prefix):
                return feature_name
        
        return None
    
    def is_exempt_route(self, path: str) -> bool:
        """
        Check if a request path is exempt from feature toggle checks
        
        Args:
            path: Request path
            
        Returns:
            True if path is exempt, False otherwise
        """
        for exempt_path in self.EXEMPT_ROUTES:
            if path.startswith(exempt_path):
                return True
        return False
    
    async def check_feature_enabled(self, request: Request) -> None:
        """
        Check if the feature for this request is enabled
        
        Requirement 16.3: Return clear error message when feature disabled
        
        Args:
            request: FastAPI request object
            
        Raises:
            HTTPException: 403 Forbidden if feature is disabled
        """
        path = request.url.path
        
        # Skip exempt routes
        if self.is_exempt_route(path):
            return
        
        # Get feature name from path
        feature = self.get_feature_from_path(path)
        
        # If no feature mapping found, allow the request
        if feature is None:
            return
        
        # Check if feature is enabled
        is_enabled = await self.get_feature_status(feature)
        
        if not is_enabled:
            logger.warning(f"Blocking request to disabled feature '{feature}': {path}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "FEATURE_DISABLED",
                        "message": f"The '{feature}' feature is currently disabled. Please contact support for more information.",
                        "feature": feature,
                        "disabled": True
                    }
                }
            )


# Singleton instance
_feature_toggle_middleware_instance: Optional[FeatureToggleMiddleware] = None


def get_feature_toggle_middleware(supabase_client: Optional[Client] = None) -> FeatureToggleMiddleware:
    """
    Get or create feature toggle middleware instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        
    Returns:
        FeatureToggleMiddleware instance
    """
    global _feature_toggle_middleware_instance
    if _feature_toggle_middleware_instance is None or supabase_client is not None:
        _feature_toggle_middleware_instance = FeatureToggleMiddleware(supabase_client)
    return _feature_toggle_middleware_instance
