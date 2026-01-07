"""
Health Check Scheduler
Periodic health checks for all providers including Hugging Face fallback models
Requirements: Provider monitoring, fallback readiness
"""
import asyncio
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone
from supabase import Client
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class HealthCheckScheduler:
    """Scheduler for periodic health checks of all providers"""
    
    def __init__(self, supabase_client: Client):
        """
        Initialize health check scheduler
        
        Args:
            supabase_client: Supabase client instance
        """
        self.supabase = supabase_client
        self.is_running = False
        self.check_interval = 300  # 5 minutes
    
    async def check_paid_api_keys(self) -> List[Dict[str, Any]]:
        """
        Check health of all active paid API keys
        
        Returns:
            List of health check results
        """
        results = []
        
        try:
            # Get all active API keys
            response = self.supabase.table("api_keys")\
                .select("*")\
                .eq("status", "active")\
                .execute()
            
            keys = response.data if response.data else []
            
            logger.info(f"Checking health of {len(keys)} active API keys")
            
            for key_data in keys:
                key_id = key_data["id"]
                provider = key_data["provider"]
                feature = key_data["feature"]
                
                try:
                    # Decrypt the key
                    from services.encryption import decrypt_key
                    api_key = decrypt_key(key_data["key_value"])
                    
                    # Perform health check based on provider
                    if provider == "openrouter":
                        from services.providers.openrouter import get_openrouter_provider
                        
                        openrouter = get_openrouter_provider()
                        
                        import time
                        start_time = time.time()
                        
                        # Minimal test call
                        result = await openrouter.call_openrouter(
                            api_key=api_key,
                            provider=provider,
                            feature=feature,
                            prompt="Test",
                            system_prompt="Respond with 'OK'"
                        )
                        
                        response_time = int((time.time() - start_time) * 1000)
                        
                        health_result = {
                            "key_id": key_id,
                            "provider": provider,
                            "feature": feature,
                            "success": result["success"],
                            "response_time_ms": response_time,
                            "error": result.get("error"),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        
                        results.append(health_result)
                        
                        # Update key status if needed
                        if not result["success"]:
                            # Increment failure count
                            current_failures = key_data.get("failure_count", 0)
                            new_failures = current_failures + 1
                            
                            self.supabase.table("api_keys")\
                                .update({"failure_count": new_failures})\
                                .eq("id", key_id)\
                                .execute()
                            
                            # Mark as degraded if threshold exceeded
                            if new_failures >= 3:
                                logger.warning(f"Key {key_id} marked as degraded after {new_failures} failures")
                                
                                self.supabase.table("api_keys")\
                                    .update({"status": "degraded"})\
                                    .eq("id", key_id)\
                                    .execute()
                                
                                # Send notification
                                try:
                                    from services.notifications import get_notification_service
                                    notif_service = get_notification_service()
                                    await notif_service.notify_api_key_failure(
                                        key_id=key_id,
                                        error=result.get("error", "Health check failed")
                                    )
                                except Exception as notif_error:
                                    logger.error(f"Failed to send notification: {str(notif_error)}")
                        else:
                            # Reset failure count on success
                            self.supabase.table("api_keys")\
                                .update({"failure_count": 0})\
                                .eq("id", key_id)\
                                .execute()
                    
                except Exception as e:
                    logger.error(f"Health check failed for key {key_id}: {str(e)}")
                    
                    results.append({
                        "key_id": key_id,
                        "provider": provider,
                        "feature": feature,
                        "success": False,
                        "response_time_ms": 0,
                        "error": str(e),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to check paid API keys: {str(e)}")
            return []
    
    async def check_huggingface_models(self) -> List[Dict[str, Any]]:
        """
        Check health of Hugging Face fallback models
        
        Returns:
            List of health check results
        """
        results = []
        
        try:
            from services.providers.huggingface import get_huggingface_provider
            
            hf_provider = get_huggingface_provider()
            
            # Check key features
            features_to_check = ["chat", "flashcard", "mcq", "clinical"]
            
            logger.info(f"Checking health of Hugging Face models for {len(features_to_check)} features")
            
            for feature in features_to_check:
                try:
                    health_result = await hf_provider.health_check(feature=feature)
                    
                    results.append({
                        "provider": "huggingface",
                        "feature": feature,
                        "model": health_result.get("model"),
                        "success": health_result["success"],
                        "response_time_ms": health_result.get("response_time_ms", 0),
                        "error": health_result.get("error"),
                        "is_loading": health_result.get("is_loading", False),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    
                    if health_result["success"]:
                        logger.info(
                            f"Hugging Face {feature} model healthy "
                            f"({health_result.get('response_time_ms')}ms)"
                        )
                    elif health_result.get("is_loading"):
                        logger.warning(f"Hugging Face {feature} model is loading (cold start)")
                    else:
                        logger.error(
                            f"Hugging Face {feature} model unhealthy: "
                            f"{health_result.get('error')}"
                        )
                    
                except Exception as e:
                    logger.error(f"Health check failed for Hugging Face {feature}: {str(e)}")
                    
                    results.append({
                        "provider": "huggingface",
                        "feature": feature,
                        "model": None,
                        "success": False,
                        "response_time_ms": 0,
                        "error": str(e),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to check Hugging Face models: {str(e)}")
            return []
    
    async def run_health_checks(self) -> Dict[str, Any]:
        """
        Run all health checks (paid APIs + Hugging Face)
        
        Returns:
            Dict with health check results
        """
        logger.info("Running scheduled health checks...")
        
        # Check paid API keys
        paid_results = await self.check_paid_api_keys()
        
        # Check Hugging Face models
        hf_results = await self.check_huggingface_models()
        
        # Calculate summary statistics
        total_checks = len(paid_results) + len(hf_results)
        successful_checks = sum(1 for r in paid_results + hf_results if r["success"])
        failed_checks = total_checks - successful_checks
        
        summary = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_checks": total_checks,
            "successful": successful_checks,
            "failed": failed_checks,
            "success_rate": (successful_checks / total_checks * 100) if total_checks > 0 else 0,
            "paid_api_results": paid_results,
            "huggingface_results": hf_results
        }
        
        logger.info(
            f"Health checks complete: {successful_checks}/{total_checks} successful "
            f"({summary['success_rate']:.1f}%)"
        )
        
        # Store results in database (optional)
        try:
            self.supabase.table("health_check_logs").insert({
                "timestamp": summary["timestamp"],
                "total_checks": total_checks,
                "successful": successful_checks,
                "failed": failed_checks,
                "results": summary
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to store health check results: {str(e)}")
        
        return summary
    
    async def start_periodic_checks(self):
        """Start periodic health checks"""
        self.is_running = True
        
        logger.info(f"Starting periodic health checks (interval: {self.check_interval}s)")
        
        while self.is_running:
            try:
                await self.run_health_checks()
            except Exception as e:
                logger.error(f"Error in periodic health check: {str(e)}")
            
            # Wait for next check
            await asyncio.sleep(self.check_interval)
    
    def stop_periodic_checks(self):
        """Stop periodic health checks"""
        self.is_running = False
        logger.info("Stopping periodic health checks")


# Singleton instance
_health_check_scheduler: Optional[HealthCheckScheduler] = None


def get_health_check_scheduler(supabase_client: Client) -> HealthCheckScheduler:
    """Get or create singleton health check scheduler instance"""
    global _health_check_scheduler
    
    if _health_check_scheduler is None:
        _health_check_scheduler = HealthCheckScheduler(supabase_client)
    
    return _health_check_scheduler
