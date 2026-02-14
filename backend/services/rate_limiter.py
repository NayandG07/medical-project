"""
Rate Limiter Service
Handles rate limiting, usage tracking, and plan-based quota enforcement
Requirements: 9.1, 9.2, 9.5, 9.6
"""
import os
from typing import Dict, Any, Optional
from datetime import date, datetime
from supabase import Client, create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


# Plan limits configuration (Requirement 9.1, 9.6)
PLAN_LIMITS = {
    "free": {
        "daily_tokens": 10000,
        "daily_requests": 20,
        "pdf_uploads": 0,
        "mcqs_per_day": 5,
        "images_per_day": 0,
        "flashcards_per_day": 10,
    },
    "student": {
        "daily_tokens": 50000,
        "daily_requests": 100,
        "pdf_uploads": 5,
        "mcqs_per_day": 50,
        "images_per_day": 10,
        "flashcards_per_day": 100,
    },
    "pro": {
        "daily_tokens": 200000,
        "daily_requests": 500,
        "pdf_uploads": 50,
        "mcqs_per_day": 200,
        "images_per_day": 50,
        "flashcards_per_day": 500,
    },
    "premium": {
        "daily_tokens": 200000,
        "daily_requests": 500,
        "pdf_uploads": 50,
        "mcqs_per_day": 200,
        "images_per_day": 50,
        "flashcards_per_day": 500,
    },
    "admin": {
        "daily_tokens": float('inf'),
        "daily_requests": float('inf'),
        "pdf_uploads": float('inf'),
        "mcqs_per_day": float('inf'),
        "flashcards_per_day": float('inf'),
    }
}


class RateLimiter:
    """Rate limiter service for usage tracking and quota enforcement"""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize the rate limiter service
        
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
    
    async def check_rate_limit(self, user_id: str, feature: str) -> bool:
        """
        Check if a user is within their rate limits for a specific feature
        
        Args:
            user_id: User's unique identifier
            feature: Feature being accessed (chat, flashcard, mcq, pdf, image)
            
        Returns:
            True if user is within limits, False if limit exceeded
            
        Requirements: 9.2, 9.5, 9.6
        """
        try:
            # Get user plan and role (Requirement 9.5 - admin bypass)
            user_response = self.supabase.table("users").select("plan, role").eq("id", user_id).execute()
            
            if not user_response.data or len(user_response.data) == 0:
                return False
            
            user_plan = user_response.data[0]["plan"]
            user_role = user_response.data[0].get("role")
            
            # Admin bypass logic (Requirement 9.5)
            if user_role in ["super_admin", "admin", "ops"]:
                return True
            
            # Get plan limits
            if user_plan not in PLAN_LIMITS:
                return False
            
            plan_limits = PLAN_LIMITS[user_plan]
            
            # Get current usage for today
            usage = await self.get_user_usage(user_id)
            
            # Multi-level rate limiting (Requirement 9.6)
            # Check token level limit
            if usage["tokens_used"] >= plan_limits["daily_tokens"]:
                return False
            
            # Check request level limit
            if usage["requests_count"] >= plan_limits["daily_requests"]:
                return False
            
            # Check feature-specific limits
            feature_limit_map = {
                "mcq": ("mcqs_generated", "mcqs_per_day"),
                "flashcard": ("flashcards_generated", "flashcards_per_day"),
                "image": ("images_used", "images_per_day"),
            }
            
            if feature in feature_limit_map:
                usage_key, limit_key = feature_limit_map[feature]
                if usage[usage_key] >= plan_limits[limit_key]:
                    return False
            
            return True
            
        except Exception as e:
            # Log error but fail closed (deny access on error)
            print(f"Rate limit check error: {str(e)}")
            return False
    
    async def increment_usage(self, user_id: str, tokens: int = 0, feature: Optional[str] = None) -> None:
        """
        Increment usage counters for a user
        
        Args:
            user_id: User's unique identifier
            tokens: Number of tokens used (for AI requests)
            feature: Optional feature name for feature-specific tracking
            
        Requirements: 9.1
        """
        try:
            today = date.today()
            
            # Get or create usage counter for today
            usage_response = self.supabase.table("usage_counters").select("*").eq("user_id", user_id).eq("date", str(today)).execute()
            
            if usage_response.data and len(usage_response.data) > 0:
                # Update existing counter
                current_usage = usage_response.data[0]
                counter_id = current_usage["id"]
                
                update_data = {
                    "tokens_used": current_usage["tokens_used"] + tokens,
                    "requests_count": current_usage["requests_count"] + 1,
                }
                
                # Update feature-specific counters
                if feature == "mcq":
                    update_data["mcqs_generated"] = current_usage["mcqs_generated"] + 1
                elif feature == "flashcard":
                    update_data["flashcards_generated"] = current_usage["flashcards_generated"] + 1
                elif feature == "pdf":
                    update_data["pdf_uploads"] = current_usage["pdf_uploads"] + 1
                elif feature == "image":
                    update_data["images_used"] = current_usage["images_used"] + 1
                
                self.supabase.table("usage_counters").update(update_data).eq("id", counter_id).execute()
            else:
                # Create new counter for today
                insert_data = {
                    "user_id": user_id,
                    "date": str(today),
                    "tokens_used": tokens,
                    "requests_count": 1,
                    "pdf_uploads": 1 if feature == "pdf" else 0,
                    "mcqs_generated": 1 if feature == "mcq" else 0,
                    "images_used": 1 if feature == "image" else 0,
                    "flashcards_generated": 1 if feature == "flashcard" else 0,
                }
                
                self.supabase.table("usage_counters").insert(insert_data).execute()
                
        except Exception as e:
            # Log error but don't fail the request
            print(f"Usage increment error: {str(e)}")
    
    async def get_user_usage(self, user_id: str) -> Dict[str, int]:
        """
        Get current usage statistics for a user (today)
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            Dict containing usage statistics
            
        Requirements: 9.1
        """
        try:
            today = date.today()
            
            usage_response = self.supabase.table("usage_counters").select("*").eq("user_id", user_id).eq("date", str(today)).execute()
            
            if usage_response.data and len(usage_response.data) > 0:
                usage = usage_response.data[0]
                return {
                    "tokens_used": usage.get("tokens_used", 0),
                    "requests_count": usage.get("requests_count", 0),
                    "pdf_uploads": usage.get("pdf_uploads", 0),
                    "mcqs_generated": usage.get("mcqs_generated", 0),
                    "images_used": usage.get("images_used", 0),
                    "flashcards_generated": usage.get("flashcards_generated", 0),
                }
            else:
                # No usage for today yet
                return {
                    "tokens_used": 0,
                    "requests_count": 0,
                    "pdf_uploads": 0,
                    "mcqs_generated": 0,
                    "images_used": 0,
                    "flashcards_generated": 0,
                }
                
        except Exception as e:
            print(f"Get usage error: {str(e)}")
            # Return zero usage on error (fail open for reads)
            return {
                "tokens_used": 0,
                "requests_count": 0,
                "pdf_uploads": 0,
                "mcqs_generated": 0,
                "images_used": 0,
                "flashcards_generated": 0,
            }
    
    async def check_feature_limit(self, user_id: str, limit_key: str) -> bool:
        """
        Check if user is within limit for a specific feature
        
        Args:
            user_id: User ID
            limit_key: Limit key (e.g., "chat_uploads_per_day", "mcq_uploads_per_day")
        
        Returns:
            True if within limit, False otherwise
        """
        try:
            # Get user plan and role
            user_response = self.supabase.table("users").select("plan, role").eq("id", user_id).execute()
            
            if not user_response.data:
                return False
            
            user_plan = user_response.data[0]["plan"]
            user_role = user_response.data[0].get("role")
            
            # Admin bypass
            if user_role in ["super_admin", "admin", "ops"]:
                return True
            
            # Get limit from system_flags (admin-configurable) or use default
            limit_response = self.supabase.table("system_flags").select("flag_value").eq("flag_name", limit_key).execute()
            
            if limit_response.data:
                limit = int(limit_response.data[0]["flag_value"])
            else:
                # Default limits per plan
                default_limits = {
                    "free": 2,
                    "student": 5,
                    "pro": 20,
                    "admin": 999999
                }
                limit = default_limits.get(user_plan, 2)
            
            # Get current usage
            today = date.today()
            usage_response = self.supabase.table("usage_counters").select("*").eq("user_id", user_id).eq("date", str(today)).execute()
            
            if usage_response.data:
                # Check custom counter for this limit_key
                current_count = usage_response.data[0].get(limit_key, 0)
                return current_count < limit
            
            return True  # No usage yet, allow
            
        except Exception as e:
            print(f"Feature limit check error: {str(e)}")
            return False
    
    async def increment_feature_usage(self, user_id: str, limit_key: str):
        """
        Increment usage counter for a specific feature
        
        Args:
            user_id: User ID
            limit_key: Limit key to increment
        """
        try:
            today = date.today()
            
            # Get or create usage counter
            usage_response = self.supabase.table("usage_counters").select("*").eq("user_id", user_id).eq("date", str(today)).execute()
            
            if usage_response.data:
                # Update existing
                current_usage = usage_response.data[0]
                counter_id = current_usage["id"]
                current_count = current_usage.get(limit_key, 0)
                
                self.supabase.table("usage_counters").update({
                    limit_key: current_count + 1
                }).eq("id", counter_id).execute()
            else:
                # Create new
                self.supabase.table("usage_counters").insert({
                    "user_id": user_id,
                    "date": str(today),
                    "tokens_used": 0,
                    "requests_count": 0,
                    "pdf_uploads": 0,
                    "mcqs_generated": 0,
                    "images_used": 0,
                    "flashcards_generated": 0,
                    limit_key: 1
                }).execute()
                
        except Exception as e:
            print(f"Feature usage increment error: {str(e)}")


# Singleton instance for easy import
_rate_limiter_instance = None


def get_rate_limiter(supabase_client: Optional[Client] = None) -> RateLimiter:
    """
    Get or create the rate limiter service instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        
    Returns:
        RateLimiter instance
    """
    global _rate_limiter_instance
    if _rate_limiter_instance is None or supabase_client is not None:
        _rate_limiter_instance = RateLimiter(supabase_client)
    return _rate_limiter_instance
