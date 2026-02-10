"""
Rate limiter for teach-back sessions.

Enforces independent rate limits with voice session cost premium.
"""

import os
from typing import Optional
from datetime import date
from supabase import Client, create_client
from dotenv import load_dotenv

from .models import RateLimitResult, QuotaInfo

load_dotenv()


# Rate limits per subscription plan
TEACH_BACK_LIMITS = {
    "free": {
        "sessions_per_day": 0,  # Feature disabled for free tier
        "voice_sessions_per_day": 0,
        "max_session_duration_minutes": 0
    },
    "student": {
        "sessions_per_day": 5,
        "voice_sessions_per_day": 2,
        "max_session_duration_minutes": 30
    },
    "pro": {
        "sessions_per_day": 20,
        "voice_sessions_per_day": 10,
        "max_session_duration_minutes": 60
    },
    "admin": {
        "sessions_per_day": 999999,  # Effectively unlimited
        "voice_sessions_per_day": 999999,
        "max_session_duration_minutes": 999999
    }
}

# Voice session cost premium (2x credits)
VOICE_SESSION_COST_MULTIPLIER = 2


class TeachBackRateLimiter:
    """Enforces rate limits for teach-back sessions."""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize rate limiter with Supabase client.
        
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
    
    async def check_session_limit(
        self,
        user_id: str,
        user_plan: str,
        is_voice: bool
    ) -> RateLimitResult:
        """
        Check if user can create a new session.
        
        Args:
            user_id: UUID of the user
            user_plan: User's subscription plan
            is_voice: Whether this is a voice session
            
        Returns:
            RateLimitResult with allowed status and remaining quota
        """
        try:
            # Get plan limits
            if user_plan not in TEACH_BACK_LIMITS:
                user_plan = "free"
            
            limits = TEACH_BACK_LIMITS[user_plan]
            
            # Check if feature is enabled for this plan
            if limits["sessions_per_day"] == 0:
                return RateLimitResult(
                    allowed=False,
                    remaining_text_sessions=0,
                    remaining_voice_sessions=0,
                    message="Teach-back feature not available on your plan. Please upgrade."
                )
            
            # Get current usage
            today = date.today()
            result = self.supabase.table("teach_back_usage")\
                .select("*")\
                .eq("user_id", user_id)\
                .eq("date", today.isoformat())\
                .execute()
            
            if result.data:
                usage = result.data[0]
                text_sessions_used = usage.get("text_sessions", 0)
                voice_sessions_used = usage.get("voice_sessions", 0)
            else:
                text_sessions_used = 0
                voice_sessions_used = 0
            
            # Calculate total sessions used (voice sessions count as 2x)
            total_sessions_used = text_sessions_used + (voice_sessions_used * VOICE_SESSION_COST_MULTIPLIER)
            
            # Check voice-specific limit if this is a voice session
            if is_voice:
                if voice_sessions_used >= limits["voice_sessions_per_day"]:
                    return RateLimitResult(
                        allowed=False,
                        remaining_text_sessions=max(0, limits["sessions_per_day"] - total_sessions_used),
                        remaining_voice_sessions=0,
                        message=f"Voice session limit reached ({limits['voice_sessions_per_day']}/day). "
                                f"Try text mode or upgrade your plan."
                    )
            
            # Check overall session limit
            session_cost = VOICE_SESSION_COST_MULTIPLIER if is_voice else 1
            if total_sessions_used + session_cost > limits["sessions_per_day"]:
                return RateLimitResult(
                    allowed=False,
                    remaining_text_sessions=max(0, limits["sessions_per_day"] - total_sessions_used),
                    remaining_voice_sessions=max(0, limits["voice_sessions_per_day"] - voice_sessions_used),
                    message=f"Daily session limit reached ({limits['sessions_per_day']}/day). "
                            f"Please try again tomorrow or upgrade your plan."
                )
            
            # Calculate remaining quota
            remaining_text = max(0, limits["sessions_per_day"] - total_sessions_used)
            remaining_voice = max(0, limits["voice_sessions_per_day"] - voice_sessions_used)
            
            return RateLimitResult(
                allowed=True,
                remaining_text_sessions=remaining_text,
                remaining_voice_sessions=remaining_voice,
                message=None
            )
            
        except Exception as e:
            # On error, deny access to be safe
            return RateLimitResult(
                allowed=False,
                remaining_text_sessions=0,
                remaining_voice_sessions=0,
                message=f"Error checking rate limit: {str(e)}"
            )
    
    async def increment_session_count(
        self,
        user_id: str,
        is_voice: bool
    ) -> None:
        """
        Increment session count for user.
        
        Args:
            user_id: UUID of the user
            is_voice: Whether this is a voice session
        """
        try:
            today = date.today()
            
            # Get current usage
            result = self.supabase.table("teach_back_usage")\
                .select("*")\
                .eq("user_id", user_id)\
                .eq("date", today.isoformat())\
                .execute()
            
            if result.data:
                # Update existing record
                usage = result.data[0]
                if is_voice:
                    new_voice = usage.get("voice_sessions", 0) + 1
                    self.supabase.table("teach_back_usage")\
                        .update({"voice_sessions": new_voice})\
                        .eq("user_id", user_id)\
                        .eq("date", today.isoformat())\
                        .execute()
                else:
                    new_text = usage.get("text_sessions", 0) + 1
                    self.supabase.table("teach_back_usage")\
                        .update({"text_sessions": new_text})\
                        .eq("user_id", user_id)\
                        .eq("date", today.isoformat())\
                        .execute()
            else:
                # Create new record
                usage_data = {
                    "user_id": user_id,
                    "date": today.isoformat(),
                    "text_sessions": 0 if is_voice else 1,
                    "voice_sessions": 1 if is_voice else 0
                }
                self.supabase.table("teach_back_usage").insert(usage_data).execute()
                
        except Exception as e:
            raise Exception(f"Error incrementing session count: {str(e)}")
    
    async def get_remaining_quota(
        self,
        user_id: str,
        user_plan: str
    ) -> QuotaInfo:
        """
        Get remaining quota information for user.
        
        Args:
            user_id: UUID of the user
            user_plan: User's subscription plan
            
        Returns:
            QuotaInfo with usage and limits
        """
        try:
            # Get plan limits
            if user_plan not in TEACH_BACK_LIMITS:
                user_plan = "free"
            
            limits = TEACH_BACK_LIMITS[user_plan]
            
            # Get current usage
            today = date.today()
            result = self.supabase.table("teach_back_usage")\
                .select("*")\
                .eq("user_id", user_id)\
                .eq("date", today.isoformat())\
                .execute()
            
            if result.data:
                usage = result.data[0]
                text_sessions_used = usage.get("text_sessions", 0)
                voice_sessions_used = usage.get("voice_sessions", 0)
            else:
                text_sessions_used = 0
                voice_sessions_used = 0
            
            return QuotaInfo(
                text_sessions_used=text_sessions_used,
                voice_sessions_used=voice_sessions_used,
                text_sessions_limit=limits["sessions_per_day"],
                voice_sessions_limit=limits["voice_sessions_per_day"],
                date=today
            )
            
        except Exception as e:
            raise Exception(f"Error getting quota info: {str(e)}")
    
    @staticmethod
    def get_plan_limits(plan: str) -> dict:
        """
        Get rate limits for a specific plan.
        
        Args:
            plan: Subscription plan name
            
        Returns:
            Dictionary of limits
        """
        return TEACH_BACK_LIMITS.get(plan, TEACH_BACK_LIMITS["free"])
