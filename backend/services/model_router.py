"""
Model Router Service
Handles provider selection, API key management, and request routing with fallback
Requirements: 10.4, 10.6, 21.1, 18.2
"""
import os
from typing import Optional, Dict, Any, List
from supabase import Client, create_client
from dotenv import load_dotenv
import logging
from services.encryption import decrypt_key
from services.notifications import get_notification_service

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class ModelRouterService:
    """
    Service for routing AI requests to appropriate providers with automatic fallback
    
    Requirements:
    - 10.4: Assign keys based on priority ordering
    - 10.6: Backend decrypts and uses the highest priority active key
    - 21.1: Model router selects providers based on feature and key health
    """
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize the model router service
        
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
    
    async def select_provider(self, feature: str) -> str:
        """
        Select the best provider for a given feature based on available keys
        
        Checks which providers have active keys and selects the first available one.
        
        Args:
            feature: Feature name (chat, flashcard, mcq, image, etc.)
            
        Returns:
            Provider name (gemini, openai, anthropic, etc.)
            
        Requirements: 21.1
        """
        try:
            # Query for active keys for this feature
            response = self.supabase.table("api_keys") \
                .select("provider") \
                .eq("feature", feature) \
                .eq("status", "active") \
                .order("priority", desc=True) \
                .limit(1) \
                .execute()
            
            if response.data and len(response.data) > 0:
                provider = response.data[0]["provider"]
                logger.info(f"Selected provider '{provider}' for feature '{feature}' (has active keys)")
                return provider
            
            # Fallback to default if no keys found
            logger.warning(f"No active keys found for feature '{feature}', using default 'openai'")
            return "openai"
            
        except Exception as e:
            logger.error(f"Error selecting provider: {str(e)}, using default 'openai'")
            return "openai"
    
    async def get_active_key(self, provider: str, feature: str) -> Optional[Dict[str, Any]]:
        """
        Get the highest priority active API key for a provider and feature
        
        Retrieves keys from the database, filters by status (active only, skips degraded),
        orders by priority, and decrypts the selected key.
        
        Args:
            provider: Provider name (gemini, openai, etc.)
            feature: Feature name (chat, flashcard, etc.)
            
        Returns:
            Dict containing:
                - id: Key ID
                - provider: Provider name
                - feature: Feature name
                - key_value: Decrypted API key (plaintext)
                - priority: Key priority
                - status: Key status
            Returns None if no active key found
            
        Requirements: 10.4, 10.6, 11.4
        """
        try:
            # Query api_keys table for active keys matching provider and feature
            # Skip degraded keys (Requirement 11.4)
            # Order by priority descending (highest priority first)
            response = self.supabase.table("api_keys") \
                .select("*") \
                .eq("provider", provider) \
                .eq("feature", feature) \
                .eq("status", "active") \
                .order("priority", desc=True) \
                .limit(1) \
                .execute()
            
            if not response.data or len(response.data) == 0:
                logger.warning(f"No active API key found for provider '{provider}', feature '{feature}'")
                return None
            
            # Get the highest priority key
            key_data = response.data[0]
            
            # Decrypt the API key (Requirement 10.6)
            try:
                decrypted_key = decrypt_key(key_data["key_value"])
                
                # Return key data with decrypted value
                result = {
                    "id": key_data["id"],
                    "provider": key_data["provider"],
                    "feature": key_data["feature"],
                    "key_value": decrypted_key,  # Decrypted plaintext key
                    "priority": key_data["priority"],
                    "status": key_data["status"]
                }
                
                logger.info(
                    f"Retrieved active key for provider '{provider}', feature '{feature}' "
                    f"(priority: {key_data['priority']})"
                )
                
                # Update last_used_at timestamp
                await self._update_last_used(key_data["id"])
                
                return result
                
            except Exception as decrypt_error:
                logger.error(f"Failed to decrypt API key {key_data['id']}: {str(decrypt_error)}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to get active key: {str(e)}")
            return None
    
    async def get_all_active_keys(self, provider: str, feature: str) -> List[Dict[str, Any]]:
        """
        Get all active API keys for a provider and feature, ordered by priority
        
        Used for fallback scenarios when the primary key fails.
        Skips degraded keys to ensure only healthy keys are used.
        
        Args:
            provider: Provider name (gemini, openai, etc.)
            feature: Feature name (chat, flashcard, etc.)
            
        Returns:
            List of key dicts, ordered by priority (highest first)
            Each dict contains: id, provider, feature, key_value (decrypted), priority, status
            Only includes keys with status='active' (degraded keys are skipped)
            
        Requirements: 10.4, 10.6, 11.4
        """
        try:
            # Query api_keys table for all active keys matching provider and feature
            # Skip degraded keys (Requirement 11.4)
            # Order by priority descending (highest priority first)
            response = self.supabase.table("api_keys") \
                .select("*") \
                .eq("provider", provider) \
                .eq("feature", feature) \
                .eq("status", "active") \
                .order("priority", desc=True) \
                .execute()
            
            if not response.data or len(response.data) == 0:
                logger.warning(f"No active API keys found for provider '{provider}', feature '{feature}'")
                return []
            
            # Decrypt all keys
            decrypted_keys = []
            for key_data in response.data:
                try:
                    decrypted_key = decrypt_key(key_data["key_value"])
                    
                    decrypted_keys.append({
                        "id": key_data["id"],
                        "provider": key_data["provider"],
                        "feature": key_data["feature"],
                        "key_value": decrypted_key,  # Decrypted plaintext key
                        "priority": key_data["priority"],
                        "status": key_data["status"]
                    })
                except Exception as decrypt_error:
                    logger.error(f"Failed to decrypt API key {key_data['id']}: {str(decrypt_error)}")
                    continue
            
            logger.info(
                f"Retrieved {len(decrypted_keys)} active keys for provider '{provider}', "
                f"feature '{feature}' (degraded keys excluded)"
            )
            
            return decrypted_keys
            
        except Exception as e:
            logger.error(f"Failed to get all active keys: {str(e)}")
            return []
    
    async def get_user_api_key(self, user_id: str) -> Optional[str]:
        """
        Get a user's personal API key if they have provided one
        
        User-supplied keys have priority over shared keys.
        
        Args:
            user_id: User's unique identifier
            
        Returns:
            Decrypted user API key if exists, None otherwise
            
        Requirements: 27.2
        """
        try:
            # Query users table for personal API key
            response = self.supabase.table("users") \
                .select("personal_api_key") \
                .eq("id", user_id) \
                .execute()
            
            if not response.data or len(response.data) == 0:
                return None
            
            encrypted_key = response.data[0].get("personal_api_key")
            
            if not encrypted_key:
                return None
            
            # Decrypt the user's personal key
            try:
                decrypted_key = decrypt_key(encrypted_key)
                logger.info(f"Retrieved personal API key for user {user_id}")
                return decrypted_key
            except Exception as decrypt_error:
                logger.error(f"Failed to decrypt user API key for {user_id}: {str(decrypt_error)}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to get user API key: {str(e)}")
            return None
    
    async def _update_last_used(self, key_id: str) -> None:
        """
        Update the last_used_at timestamp for an API key
        
        Args:
            key_id: API key ID
        """
        try:
            from datetime import datetime
            
            self.supabase.table("api_keys") \
                .update({"last_used_at": datetime.utcnow().isoformat()}) \
                .eq("id", key_id) \
                .execute()
                
        except Exception as e:
            # Don't fail the request if timestamp update fails
            logger.warning(f"Failed to update last_used_at for key {key_id}: {str(e)}")
    
    async def record_failure(self, key_id: str, error: str) -> None:
        """
        Record a failure for an API key
        
        Increments the failure_count for the key.
        
        Args:
            key_id: API key ID
            error: Error message describing the failure
            
        Requirements: 21.2, 21.3
        """
        try:
            # Get current failure count
            response = self.supabase.table("api_keys") \
                .select("failure_count") \
                .eq("id", key_id) \
                .execute()
            
            if response.data and len(response.data) > 0:
                current_count = response.data[0].get("failure_count", 0)
                new_count = current_count + 1
                
                # Update failure count
                self.supabase.table("api_keys") \
                    .update({"failure_count": new_count}) \
                    .eq("id", key_id) \
                    .execute()
                
                logger.warning(
                    f"Recorded failure for key {key_id}. "
                    f"Failure count: {new_count}. Error: {error}"
                )
                
        except Exception as e:
            logger.error(f"Failed to record failure for key {key_id}: {str(e)}")
    
    async def execute_with_fallback(
        self,
        provider: str,
        feature: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_retries: int = 3,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute a request with automatic fallback to next available key on failure
        
        Tries up to max_retries times with different keys before giving up.
        Falls back to Hugging Face medical models if all paid API keys fail.
        Records failures for each failed key and logs all attempts.
        User-supplied keys have priority over shared keys.
        
        Args:
            provider: Provider name (gemini, openai, etc.)
            feature: Feature name (chat, flashcard, etc.)
            prompt: User prompt/message
            system_prompt: Optional system prompt for context
            max_retries: Maximum number of retry attempts (default: 3)
            user_id: Optional user ID to check for personal API key
            
        Returns:
            Dict containing:
                - success: bool indicating if call succeeded
                - content: Generated text content (if success)
                - error: Error message (if not success)
                - tokens_used: Token count
                - key_id: ID of the key that succeeded (if success)
                - attempts: Number of attempts made
                - used_user_key: bool indicating if user's personal key was used
                - used_fallback_model: bool indicating if Hugging Face fallback was used
                
        Requirements: 21.2, 21.3, 27.2, 27.7
        """
        from services.model_usage_logger import get_model_usage_logger
        import time
        
        usage_logger = get_model_usage_logger(self.supabase)
        
        # Check if user has a personal API key (Requirement 27.2)
        user_key = None
        if user_id:
            user_key = await self.get_user_api_key(user_id)
        
        # Get all active keys for this provider and feature
        keys = await self.get_all_active_keys(provider, feature)
        
        # If user has a personal key, try it first (Requirement 27.2)
        if user_key:
            logger.info(f"User {user_id} has personal API key, will try it first")
            
            # Try user's personal key first
            logger.info(f"Attempt 1/{max_retries}: Trying user's personal API key")
            
            start_time = time.time()
            
            try:
                # Use OpenRouter for all providers
                from services.providers.openrouter import get_openrouter_provider
                provider_instance = get_openrouter_provider()
                
                # Call OpenRouter with user's key
                result = await provider_instance.call_openrouter(
                    api_key=user_key,
                    provider=provider,
                    feature=feature,
                    prompt=prompt,
                    system_prompt=system_prompt
                )
                
                response_time = int((time.time() - start_time) * 1000)
                
                # Log the attempt
                await usage_logger.log_model_call(
                    user_id=user_id,
                    provider=provider,
                    model=result.get("model", "unknown"),
                    feature=feature,
                    success=result["success"],
                    tokens_used=result.get("tokens_used", 0),
                    error=result.get("error"),
                    key_id=f"user_{user_id}",
                    was_fallback=False,
                    attempt_number=1,
                    response_time_ms=response_time
                )
                
                if result["success"]:
                    logger.info(
                        f"Request succeeded with user's personal API key. "
                        f"Tokens used: {result['tokens_used']}"
                    )
                        
                    # Add metadata to result
                    result["key_id"] = f"user_{user_id}"
                    result["attempts"] = 1
                    result["used_user_key"] = True
                    result["used_fallback_model"] = False
                    
                    return result
                else:
                    # User's key failed, log and fall back to shared keys (Requirement 27.7)
                    error_msg = result.get("error", "Unknown error")
                    logger.warning(
                        f"User's personal API key failed: {error_msg}. "
                        f"Falling back to shared keys."
                    )
                    
                    # Continue to shared keys below
                    
            except Exception as e:
                error_msg = f"Unexpected error with user's personal key: {str(e)}"
                logger.warning(f"{error_msg}. Falling back to shared keys.")
                
                # Log the failed attempt
                response_time = int((time.time() - start_time) * 1000)
                await usage_logger.log_model_call(
                    user_id=user_id,
                    provider=provider,
                    model="unknown",
                    feature=feature,
                    success=False,
                    tokens_used=0,
                    error=error_msg,
                    key_id=f"user_{user_id}",
                    was_fallback=False,
                    attempt_number=1,
                    response_time_ms=response_time
                )
                # Continue to shared keys below
        
        # If no user key or user key failed, use shared keys
        if not keys:
            logger.warning(f"No active keys available for provider '{provider}', feature '{feature}'. Trying Hugging Face fallback...")
            
            # Try Hugging Face as fallback
            return await self._try_huggingface_fallback(
                feature=feature,
                prompt=prompt,
                system_prompt=system_prompt,
                user_id=user_id,
                attempt_number=1 if user_key else 0
            )
        
        # Limit attempts to available keys or max_retries, whichever is smaller
        max_attempts = min(len(keys), max_retries)
        
        # Calculate starting attempt number (1 if user key was tried, 0 otherwise)
        starting_attempt = 1 if user_key else 0
        
        logger.info(
            f"Starting request with fallback. Provider: {provider}, Feature: {feature}, "
            f"Available keys: {len(keys)}, Max attempts: {max_attempts}, "
            f"User key tried: {user_key is not None}"
        )
        
        # Try each key in priority order
        for attempt in range(max_attempts):
            key = keys[attempt]
            key_id = key["id"]
            api_key = key["key_value"]
            
            # Calculate actual attempt number (including user key attempt if it happened)
            actual_attempt = starting_attempt + attempt + 1
            
            logger.info(
                f"Attempt {actual_attempt}/{starting_attempt + max_attempts}: Trying key {key_id} "
                f"(priority: {key['priority']})"
            )
            
            start_time = time.time()
            
            try:
                # Use OpenRouter for all providers
                from services.providers.openrouter import get_openrouter_provider
                provider_instance = get_openrouter_provider()
                
                # Call OpenRouter
                result = await provider_instance.call_openrouter(
                    api_key=api_key,
                    provider=provider,
                    feature=feature,
                    prompt=prompt,
                    system_prompt=system_prompt
                )
                
                response_time = int((time.time() - start_time) * 1000)
                
                # Log the attempt
                await usage_logger.log_model_call(
                    user_id=user_id,
                    provider=provider,
                    model=result.get("model", "unknown"),
                    feature=feature,
                    success=result["success"],
                    tokens_used=result.get("tokens_used", 0),
                    error=result.get("error"),
                    key_id=key_id,
                    was_fallback=(attempt > 0 or user_key is not None),
                    attempt_number=actual_attempt,
                    response_time_ms=response_time
                )
                
                if result["success"]:
                    logger.info(
                        f"Request succeeded with key {key_id} on attempt {actual_attempt}. "
                        f"Tokens used: {result['tokens_used']}"
                    )
                    
                    # If we had to fallback (attempt > 0 or user_key was tried), send notification (Requirement 18.2)
                    if attempt > 0 or user_key:
                        try:
                            notification_service = get_notification_service()
                            # If user key was tried, it was the first attempt that failed
                            if user_key and attempt == 0:
                                from_key_id = f"user_{user_id}"
                            else:
                                from_key_id = keys[0]["id"] if attempt > 0 else f"user_{user_id}"
                            
                            await notification_service.notify_fallback(
                                from_key_id=from_key_id,
                                to_key_id=key_id,
                                provider=provider,
                                feature=feature
                            )
                        except Exception as notif_error:
                            logger.warning(f"Failed to send fallback notification: {str(notif_error)}")
                    
                    # Add metadata to result
                    result["key_id"] = key_id
                    result["attempts"] = actual_attempt
                    result["used_user_key"] = False
                    result["used_fallback_model"] = False
                    
                    return result
                else:
                    # Provider call failed, record failure and try next key
                    error_msg = result.get("error", "Unknown error")
                    is_token_limit = result.get("is_token_limit_error", False)
                    
                    logger.warning(
                        f"Key {key_id} failed on attempt {actual_attempt}: {error_msg}"
                    )
                    
                    # Record the failure
                    await self.record_failure(key_id, error_msg)
                    
                    # If this is a token limit error, skip remaining paid APIs and go straight to Hugging Face
                    if is_token_limit:
                        logger.warning(
                            f"Token limit error detected. Skipping remaining paid APIs and "
                            f"trying Hugging Face fallback (supports longer contexts)..."
                        )
                        
                        return await self._try_huggingface_fallback(
                            feature=feature,
                            prompt=prompt,
                            system_prompt=system_prompt,
                            user_id=user_id,
                            attempt_number=actual_attempt,
                            reason="token_limit_exceeded"
                        )
                    
                    # If this was the last attempt, try Hugging Face fallback
                    if attempt == max_attempts - 1:
                        logger.warning(
                            f"All paid API keys failed for provider '{provider}', feature '{feature}'. "
                            f"Trying Hugging Face fallback..."
                        )
                        
                        return await self._try_huggingface_fallback(
                            feature=feature,
                            prompt=prompt,
                            system_prompt=system_prompt,
                            user_id=user_id,
                            attempt_number=actual_attempt
                        )
                    
                    # Otherwise, continue to next key
                    continue
                    
            except Exception as e:
                error_msg = f"Unexpected error: {str(e)}"
                logger.error(f"Key {key_id} failed with exception on attempt {actual_attempt}: {error_msg}")
                
                response_time = int((time.time() - start_time) * 1000)
                
                # Log the failed attempt
                await usage_logger.log_model_call(
                    user_id=user_id,
                    provider=provider,
                    model="unknown",
                    feature=feature,
                    success=False,
                    tokens_used=0,
                    error=error_msg,
                    key_id=key_id,
                    was_fallback=(attempt > 0 or user_key is not None),
                    attempt_number=actual_attempt,
                    response_time_ms=response_time
                )
                
                # Record the failure
                await self.record_failure(key_id, error_msg)
                
                # Check if this might be a token limit error
                is_token_limit = "token" in str(e).lower() and ("limit" in str(e).lower() or "context" in str(e).lower())
                
                if is_token_limit:
                    logger.warning(
                        f"Possible token limit error. Trying Hugging Face fallback..."
                    )
                    
                    return await self._try_huggingface_fallback(
                        feature=feature,
                        prompt=prompt,
                        system_prompt=system_prompt,
                        user_id=user_id,
                        attempt_number=actual_attempt,
                        reason="token_limit_exceeded"
                    )
                
                # If this was the last attempt, try Hugging Face fallback
                if attempt == max_attempts - 1:
                    logger.warning(
                        f"All paid API keys failed for provider '{provider}', feature '{feature}'. "
                        f"Trying Hugging Face fallback..."
                    )
                    
                    return await self._try_huggingface_fallback(
                        feature=feature,
                        prompt=prompt,
                        system_prompt=system_prompt,
                        user_id=user_id,
                        attempt_number=actual_attempt
                    )
                
                # Otherwise, continue to next key
                continue
        
        # Should not reach here, but just in case
        return {
            "success": False,
            "error": "All retry attempts exhausted",
            "tokens_used": 0,
            "attempts": starting_attempt + max_attempts,
            "used_user_key": False,
            "used_fallback_model": False
        }
    
    async def _try_huggingface_fallback(
        self,
        feature: str,
        prompt: str,
        system_prompt: Optional[str],
        user_id: Optional[str],
        attempt_number: int,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Try Hugging Face medical models as final fallback
        
        Args:
            feature: Feature name
            prompt: User prompt
            system_prompt: System prompt
            user_id: User ID
            attempt_number: Current attempt number
            reason: Reason for fallback (e.g., "token_limit_exceeded")
            
        Returns:
            Result dict with success, content, etc.
        """
        from services.providers.huggingface import get_huggingface_provider
        from services.model_usage_logger import get_model_usage_logger
        import time
        
        usage_logger = get_model_usage_logger(self.supabase)
        hf_provider = get_huggingface_provider()
        
        reason_msg = f" (reason: {reason})" if reason else ""
        logger.info(f"Attempting Hugging Face fallback for feature: {feature}{reason_msg}")
        
        start_time = time.time()
        
        try:
            result = await hf_provider.call_huggingface(
                feature=feature,
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            response_time = int((time.time() - start_time) * 1000)
            
            # Log the attempt
            await usage_logger.log_model_call(
                user_id=user_id,
                provider="huggingface",
                model=result.get("model", "unknown"),
                feature=feature,
                success=result["success"],
                tokens_used=result.get("tokens_used", 0),
                error=result.get("error"),
                key_id=None,
                was_fallback=True,
                attempt_number=attempt_number + 1,
                response_time_ms=response_time
            )
            
            if result["success"]:
                logger.info(
                    f"Hugging Face fallback succeeded! Model: {result.get('model')}, "
                    f"Tokens: {result.get('tokens_used')}"
                )
                
                # Send notification about fallback to open-source model
                try:
                    notification_service = get_notification_service()
                    await notification_service.notify_fallback(
                        from_key_id="paid_apis",
                        to_key_id="huggingface_fallback",
                        provider="huggingface",
                        feature=feature
                    )
                except Exception as notif_error:
                    logger.warning(f"Failed to send fallback notification: {str(notif_error)}")
                
                result["attempts"] = attempt_number + 1
                result["used_user_key"] = False
                result["used_fallback_model"] = True
                result["key_id"] = "huggingface_fallback"
                result["fallback_reason"] = reason
                
                return result
            else:
                # Even Hugging Face failed - trigger maintenance
                logger.error(
                    f"Hugging Face fallback also failed for feature '{feature}'. "
                    f"Triggering maintenance mode."
                )
                
                # Import maintenance service
                from services.maintenance import get_maintenance_service
                
                try:
                    maintenance_service = get_maintenance_service(self.supabase)
                    
                    # Evaluate if maintenance should be triggered
                    maintenance_level = await maintenance_service.evaluate_maintenance_trigger(
                        feature=feature,
                        failures=attempt_number + 1
                    )
                    
                    if maintenance_level:
                        # Enter maintenance mode
                        await maintenance_service.enter_maintenance(
                            level=maintenance_level,
                            reason=f"All API keys and fallback models failed for {feature}",
                            feature=feature
                        )
                        logger.info(f"Entered {maintenance_level} maintenance mode for {feature}")
                except Exception as maint_error:
                    logger.error(f"Failed to trigger maintenance mode: {str(maint_error)}")
                
                result["attempts"] = attempt_number + 1
                result["used_user_key"] = False
                result["used_fallback_model"] = True
                
                return result
                
        except Exception as e:
            error_msg = f"Hugging Face fallback error: {str(e)}"
            logger.error(error_msg)
            
            response_time = int((time.time() - start_time) * 1000)
            
            # Log the failed attempt
            await usage_logger.log_model_call(
                user_id=user_id,
                provider="huggingface",
                model="unknown",
                feature=feature,
                success=False,
                tokens_used=0,
                error=error_msg,
                key_id=None,
                was_fallback=True,
                attempt_number=attempt_number + 1,
                response_time_ms=response_time
            )
            
            # Trigger maintenance
            from services.maintenance import get_maintenance_service
            
            try:
                maintenance_service = get_maintenance_service(self.supabase)
                maintenance_level = await maintenance_service.evaluate_maintenance_trigger(
                    feature=feature,
                    failures=attempt_number + 1
                )
                
                if maintenance_level:
                    await maintenance_service.enter_maintenance(
                        level=maintenance_level,
                        reason=f"All API keys and fallback models failed for {feature}",
                        feature=feature
                    )
            except Exception as maint_error:
                logger.error(f"Failed to trigger maintenance mode: {str(maint_error)}")
            
            return {
                "success": False,
                "error": error_msg,
                "tokens_used": 0,
                "attempts": attempt_number + 1,
                "used_user_key": False,
                "used_fallback_model": True
            }


# Singleton instance
_model_router_service: Optional[ModelRouterService] = None


def get_model_router_service(supabase_client: Optional[Client] = None) -> ModelRouterService:
    """
    Get or create the singleton model router service instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        
    Returns:
        ModelRouterService instance
    """
    global _model_router_service
    
    if _model_router_service is None or supabase_client is not None:
        _model_router_service = ModelRouterService(supabase_client)
    
    return _model_router_service
