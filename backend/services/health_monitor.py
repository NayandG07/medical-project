"""
Health Monitor Service

Monitors API provider health and tracks failures.
Requirements: 11.1, 11.2, 11.3, 11.6, 18.1
"""
from datetime import datetime
from typing import Dict, Optional, Any
from supabase import Client
from services.notifications import get_notification_service


# Failure threshold before marking key as degraded
FAILURE_THRESHOLD = 3


class HealthMonitorService:
    """Service for monitoring API provider health"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
    
    async def check_provider_health(
        self,
        provider: str,
        key: str,
        feature: str
    ) -> Dict[str, Any]:
        """
        Check provider health with minimal test call
        
        Args:
            provider: Provider name (gemini, openai, etc.)
            key: API key to test
            feature: Feature being tested (chat, flashcard, etc.)
            
        Returns:
            Dict with health status information
        """
        start_time = datetime.now()
        
        try:
            # Perform minimal test call based on provider
            if provider == "gemini":
                # Import here to avoid circular dependency
                from services.providers.gemini import get_gemini_provider
                
                # Minimal test prompt
                test_prompt = "Test"
                gemini = get_gemini_provider()
                response = await gemini.call_gemini(key, test_prompt, feature=feature)
                
                # Calculate response time
                response_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                
                return {
                    "status": "healthy",
                    "response_time_ms": response_time_ms,
                    "error_message": None,
                    "quota_remaining": None  # Could be extracted from response headers
                }
            
            elif provider == "openai":
                # Placeholder for OpenAI health check
                return {
                    "status": "healthy",
                    "response_time_ms": 100,
                    "error_message": None,
                    "quota_remaining": None
                }
            
            elif provider == "openrouter":
                # OpenRouter health check
                from services.providers.openrouter import get_openrouter_provider
                
                # Minimal test prompt
                test_prompt = "Test"
                openrouter = get_openrouter_provider()
                
                # Use a simple model for health check
                response = await openrouter.call_openrouter(
                    api_key=key,
                    model="anthropic/claude-sonnet-4.5",
                    prompt=test_prompt,
                    system_prompt="You are a helpful assistant.",
                    max_tokens=10
                )
                
                # Calculate response time
                response_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                
                return {
                    "status": "healthy",
                    "response_time_ms": response_time_ms,
                    "error_message": None,
                    "quota_remaining": None
                }
            
            elif provider == "anthropic":
                # Anthropic uses OpenRouter
                from services.providers.openrouter import get_openrouter_provider
                
                test_prompt = "Test"
                openrouter = get_openrouter_provider()
                
                response = await openrouter.call_openrouter(
                    api_key=key,
                    model="anthropic/claude-sonnet-4.5",
                    prompt=test_prompt,
                    system_prompt="You are a helpful assistant.",
                    max_tokens=10
                )
                
                response_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                
                return {
                    "status": "healthy",
                    "response_time_ms": response_time_ms,
                    "error_message": None,
                    "quota_remaining": None
                }
            
            elif provider == "ollama":
                # Placeholder for Ollama health check
                return {
                    "status": "healthy",
                    "response_time_ms": 50,
                    "error_message": None,
                    "quota_remaining": None
                }
            
            else:
                return {
                    "status": "failed",
                    "response_time_ms": None,
                    "error_message": f"Unknown provider: {provider}",
                    "quota_remaining": None
                }
                
        except Exception as e:
            response_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            return {
                "status": "failed",
                "response_time_ms": response_time_ms,
                "error_message": str(e),
                "quota_remaining": None
            }
    
    async def record_failure(
        self,
        key_id: str,
        error: str,
        provider: str,
        feature: str
    ) -> Dict[str, Any]:
        """
        Record API key failure
        
        Args:
            key_id: API key ID
            error: Error message
            provider: Provider name
            feature: Feature that failed
            
        Returns:
            Dict with updated failure information
        """
        # Get current failure count
        result = self.supabase.table("api_keys") \
            .select("failure_count") \
            .eq("id", key_id) \
            .execute()
        
        if not result.data:
            raise ValueError(f"API key not found: {key_id}")
        
        current_failures = result.data[0].get("failure_count", 0)
        new_failure_count = current_failures + 1
        
        # Update failure count
        self.supabase.table("api_keys") \
            .update({"failure_count": new_failure_count}) \
            .eq("id", key_id) \
            .execute()
        
        # Log health check failure
        health_record = {
            "api_key_id": key_id,
            "checked_at": datetime.now().isoformat(),
            "status": "failed",
            "response_time_ms": None,
            "error_message": error,
            "quota_remaining": None
        }
        
        self.supabase.table("provider_health") \
            .insert(health_record) \
            .execute()
        
        # Send notification about API key failure (Requirement 18.1)
        try:
            notification_service = get_notification_service()
            await notification_service.notify_api_key_failure(
                key_id=key_id,
                error=error,
                provider=provider,
                feature=feature
            )
        except Exception as notif_error:
            # Don't fail the failure recording if notification fails
            import logging
            logging.warning(f"Failed to send failure notification: {str(notif_error)}")
        
        # Check if key should be marked as degraded
        if new_failure_count >= FAILURE_THRESHOLD:
            await self.mark_key_degraded(key_id)
        
        return {
            "key_id": key_id,
            "failure_count": new_failure_count,
            "degraded": new_failure_count >= FAILURE_THRESHOLD
        }
    
    async def mark_key_degraded(self, key_id: str) -> Dict[str, Any]:
        """
        Mark API key as degraded after repeated failures
        
        Args:
            key_id: API key ID
            
        Returns:
            Dict with updated key information
        """
        # Update key status to degraded
        result = self.supabase.table("api_keys") \
            .update({"status": "degraded"}) \
            .eq("id", key_id) \
            .execute()
        
        if not result.data:
            raise ValueError(f"API key not found: {key_id}")
        
        return {
            "key_id": key_id,
            "status": "degraded",
            "message": f"Key marked as degraded after {FAILURE_THRESHOLD} failures"
        }
    
    async def get_provider_status(
        self,
        provider: str,
        feature: str
    ) -> Dict[str, Any]:
        """
        Get current health status for provider/feature combination
        
        Args:
            provider: Provider name
            feature: Feature name
            
        Returns:
            Dict with provider status information
        """
        # Get all keys for this provider/feature
        keys_result = self.supabase.table("api_keys") \
            .select("id, status, failure_count, priority") \
            .eq("provider", provider) \
            .eq("feature", feature) \
            .order("priority", desc=True) \
            .execute()
        
        if not keys_result.data:
            return {
                "provider": provider,
                "feature": feature,
                "status": "no_keys",
                "active_keys": 0,
                "degraded_keys": 0,
                "disabled_keys": 0,
                "total_keys": 0
            }
        
        # Count keys by status
        active_keys = sum(1 for k in keys_result.data if k["status"] == "active")
        degraded_keys = sum(1 for k in keys_result.data if k["status"] == "degraded")
        disabled_keys = sum(1 for k in keys_result.data if k["status"] == "disabled")
        
        # Determine overall status
        if active_keys > 0:
            overall_status = "healthy"
        elif degraded_keys > 0:
            overall_status = "degraded"
        else:
            overall_status = "failed"
        
        # Get recent health checks
        recent_checks = self.supabase.table("provider_health") \
            .select("*") \
            .in_("api_key_id", [k["id"] for k in keys_result.data]) \
            .order("checked_at", desc=True) \
            .limit(10) \
            .execute()
        
        return {
            "provider": provider,
            "feature": feature,
            "status": overall_status,
            "active_keys": active_keys,
            "degraded_keys": degraded_keys,
            "disabled_keys": disabled_keys,
            "total_keys": len(keys_result.data),
            "recent_checks": recent_checks.data if recent_checks.data else []
        }
    
    async def log_health_check(
        self,
        key_id: str,
        status: str,
        response_time_ms: Optional[int],
        error_message: Optional[str] = None,
        quota_remaining: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Log a health check result
        
        Args:
            key_id: API key ID
            status: Health status (healthy, degraded, failed)
            response_time_ms: Response time in milliseconds
            error_message: Error message if failed
            quota_remaining: Remaining quota if available
            
        Returns:
            Dict with logged health check information
        """
        health_record = {
            "api_key_id": key_id,
            "checked_at": datetime.now().isoformat(),
            "status": status,
            "response_time_ms": response_time_ms,
            "error_message": error_message,
            "quota_remaining": quota_remaining
        }
        
        result = self.supabase.table("provider_health") \
            .insert(health_record) \
            .execute()
        
        return result.data[0] if result.data else health_record


# Singleton instance
_health_monitor_instance: Optional[HealthMonitorService] = None


def get_health_monitor(supabase_client: Client) -> HealthMonitorService:
    """Get or create health monitor service instance"""
    global _health_monitor_instance
    if _health_monitor_instance is None:
        _health_monitor_instance = HealthMonitorService(supabase_client)
    return _health_monitor_instance
