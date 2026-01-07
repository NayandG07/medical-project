"""
Model Usage Logger Service
Logs all model API calls for monitoring and reporting
Requirements: Admin visibility, cost tracking, fallback monitoring
"""
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from supabase import Client, create_client
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)


class ModelUsageLogger:
    """Service for logging model usage and API calls"""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize the model usage logger
        
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
    
    async def log_model_call(
        self,
        user_id: Optional[str],
        provider: str,
        model: str,
        feature: str,
        success: bool,
        tokens_used: int,
        error: Optional[str] = None,
        key_id: Optional[str] = None,
        was_fallback: bool = False,
        attempt_number: int = 1,
        response_time_ms: Optional[int] = None
    ) -> None:
        """
        Log a model API call
        
        Args:
            user_id: User who made the request (None for system calls)
            provider: Provider name (openrouter, huggingface, etc.)
            model: Specific model used
            feature: Feature name (chat, flashcard, etc.)
            success: Whether the call succeeded
            tokens_used: Number of tokens consumed
            error: Error message if failed
            key_id: API key ID used
            was_fallback: Whether this was a fallback attempt
            attempt_number: Attempt number (1 for first try)
            response_time_ms: Response time in milliseconds
        """
        try:
            log_entry = {
                "user_id": user_id,
                "provider": provider,
                "model": model,
                "feature": feature,
                "success": success,
                "tokens_used": tokens_used,
                "error": error,
                "key_id": key_id,
                "was_fallback": was_fallback,
                "attempt_number": attempt_number,
                "response_time_ms": response_time_ms,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            self.supabase.table("model_usage_logs").insert(log_entry).execute()
            
            logger.info(
                f"Logged model call: {provider}/{model} for {feature} "
                f"(success: {success}, tokens: {tokens_used}, fallback: {was_fallback})"
            )
            
        except Exception as e:
            # Don't fail the request if logging fails
            logger.error(f"Failed to log model call: {str(e)}")
    
    async def get_usage_stats(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        provider: Optional[str] = None,
        feature: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get usage statistics with optional filters
        
        Args:
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            provider: Filter by provider
            feature: Filter by feature
            user_id: Filter by user
            
        Returns:
            Dict with usage statistics
        """
        try:
            # Build query
            query = self.supabase.table("model_usage_logs").select("*")
            
            if start_date:
                query = query.gte("timestamp", start_date)
            if end_date:
                query = query.lte("timestamp", end_date)
            if provider:
                query = query.eq("provider", provider)
            if feature:
                query = query.eq("feature", feature)
            if user_id:
                query = query.eq("user_id", user_id)
            
            response = query.execute()
            logs = response.data if response.data else []
            
            # Calculate statistics
            total_calls = len(logs)
            successful_calls = sum(1 for log in logs if log["success"])
            failed_calls = total_calls - successful_calls
            total_tokens = sum(log["tokens_used"] for log in logs)
            fallback_calls = sum(1 for log in logs if log["was_fallback"])
            
            # Group by provider
            by_provider = {}
            for log in logs:
                prov = log["provider"]
                if prov not in by_provider:
                    by_provider[prov] = {
                        "calls": 0,
                        "tokens": 0,
                        "failures": 0,
                        "fallbacks": 0
                    }
                by_provider[prov]["calls"] += 1
                by_provider[prov]["tokens"] += log["tokens_used"]
                if not log["success"]:
                    by_provider[prov]["failures"] += 1
                if log["was_fallback"]:
                    by_provider[prov]["fallbacks"] += 1
            
            # Group by feature
            by_feature = {}
            for log in logs:
                feat = log["feature"]
                if feat not in by_feature:
                    by_feature[feat] = {
                        "calls": 0,
                        "tokens": 0,
                        "failures": 0
                    }
                by_feature[feat]["calls"] += 1
                by_feature[feat]["tokens"] += log["tokens_used"]
                if not log["success"]:
                    by_feature[feat]["failures"] += 1
            
            # Group by model
            by_model = {}
            for log in logs:
                model = log["model"]
                if model not in by_model:
                    by_model[model] = {
                        "calls": 0,
                        "tokens": 0,
                        "failures": 0
                    }
                by_model[model]["calls"] += 1
                by_model[model]["tokens"] += log["tokens_used"]
                if not log["success"]:
                    by_model[model]["failures"] += 1
            
            return {
                "total_calls": total_calls,
                "successful_calls": successful_calls,
                "failed_calls": failed_calls,
                "total_tokens": total_tokens,
                "fallback_calls": fallback_calls,
                "fallback_rate": (fallback_calls / total_calls * 100) if total_calls > 0 else 0,
                "success_rate": (successful_calls / total_calls * 100) if total_calls > 0 else 0,
                "by_provider": by_provider,
                "by_feature": by_feature,
                "by_model": by_model
            }
            
        except Exception as e:
            logger.error(f"Failed to get usage stats: {str(e)}")
            return {
                "error": str(e),
                "total_calls": 0,
                "successful_calls": 0,
                "failed_calls": 0,
                "total_tokens": 0,
                "fallback_calls": 0
            }
    
    async def get_recent_logs(
        self,
        limit: int = 100,
        provider: Optional[str] = None,
        feature: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get recent model usage logs
        
        Args:
            limit: Maximum number of logs to return
            provider: Filter by provider
            feature: Filter by feature
            
        Returns:
            List of log entries
        """
        try:
            query = self.supabase.table("model_usage_logs")\
                .select("*")\
                .order("timestamp", desc=True)\
                .limit(limit)
            
            if provider:
                query = query.eq("provider", provider)
            if feature:
                query = query.eq("feature", feature)
            
            response = query.execute()
            return response.data if response.data else []
            
        except Exception as e:
            logger.error(f"Failed to get recent logs: {str(e)}")
            return []
    
    async def get_fallback_report(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get detailed fallback report
        
        Args:
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            
        Returns:
            Dict with fallback statistics
        """
        try:
            query = self.supabase.table("model_usage_logs")\
                .select("*")\
                .eq("was_fallback", True)
            
            if start_date:
                query = query.gte("timestamp", start_date)
            if end_date:
                query = query.lte("timestamp", end_date)
            
            response = query.execute()
            fallback_logs = response.data if response.data else []
            
            # Analyze fallbacks
            total_fallbacks = len(fallback_logs)
            
            # Group by feature
            by_feature = {}
            for log in fallback_logs:
                feat = log["feature"]
                if feat not in by_feature:
                    by_feature[feat] = 0
                by_feature[feat] += 1
            
            # Group by provider fallen back to
            by_provider = {}
            for log in fallback_logs:
                prov = log["provider"]
                if prov not in by_provider:
                    by_provider[prov] = 0
                by_provider[prov] += 1
            
            return {
                "total_fallbacks": total_fallbacks,
                "by_feature": by_feature,
                "by_provider": by_provider,
                "recent_fallbacks": fallback_logs[:20]  # Last 20 fallbacks
            }
            
        except Exception as e:
            logger.error(f"Failed to get fallback report: {str(e)}")
            return {
                "error": str(e),
                "total_fallbacks": 0
            }


# Singleton instance
_model_usage_logger: Optional[ModelUsageLogger] = None


def get_model_usage_logger(supabase_client: Optional[Client] = None) -> ModelUsageLogger:
    """Get or create singleton model usage logger instance"""
    global _model_usage_logger
    
    if _model_usage_logger is None or supabase_client is not None:
        _model_usage_logger = ModelUsageLogger(supabase_client)
    
    return _model_usage_logger
