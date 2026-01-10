"""
OpenRouter Provider Integration
Unified access to multiple AI providers (OpenAI, Anthropic, Google) through OpenRouter
"""
import httpx
import logging
from typing import Dict, Any, Optional, AsyncIterator
import json
import os

logger = logging.getLogger(__name__)


class OpenRouterProvider:
    """
    Provider integration for OpenRouter
    Provides unified access to OpenAI, Anthropic, and Google models
    """
    
    # OpenRouter API endpoint
    BASE_URL = "https://openrouter.ai/api/v1"
    
    def __init__(self):
        """Initialize the OpenRouter provider"""
        self.client = httpx.AsyncClient(timeout=60.0)
        self._models_cache = None
    
    def _load_models_config(self) -> Dict[str, Any]:
        """
        Load models configuration from models.json
        
        Returns:
            Dict containing model mappings for all providers
        """
        if self._models_cache is not None:
            return self._models_cache
        
        try:
            # Get the path to models.json (in backend directory)
            # __file__ is in backend/services/providers/openrouter.py
            # We need to go up 2 levels to get to backend/
            current_dir = os.path.dirname(os.path.abspath(__file__))  # backend/services/providers
            services_dir = os.path.dirname(current_dir)  # backend/services
            backend_dir = os.path.dirname(services_dir)  # backend
            models_path = os.path.join(backend_dir, "models.json")
            
            with open(models_path, "r") as f:
                self._models_cache = json.load(f)
            
            logger.info(f"Loaded models configuration from {models_path}")
            return self._models_cache
        except Exception as e:
            logger.error(f"Failed to load models.json: {str(e)}")
            # Return empty dict as fallback
            return {}
    
    def get_model_id(self, provider: str, feature: str) -> str:
        """
        Get the OpenRouter model ID based on provider and feature
        
        Since we're using OpenRouter API for all providers, we always use
        the "openrouter" section from models.json regardless of the provider
        name stored in the database.
        
        Args:
            provider: Provider name (openrouter, gemini, openai, anthropic) - ignored, always uses openrouter
            feature: Feature name (chat, flashcard, mcq, etc.)
            
        Returns:
            OpenRouter model ID
        """
        # Load models from models.json
        models_config = self._load_models_config()
        
        # Always use the "openrouter" section since we're using OpenRouter API
        # This allows using OpenRouter API key with any provider's models
        if "openrouter" in models_config:
            openrouter_models = models_config["openrouter"]
            model_id = openrouter_models.get(feature)
            
            if model_id:
                logger.info(f"Using OpenRouter model for {feature}: {model_id}")
                return model_id
        
        # Final fallback: use a default model
        logger.warning(f"No OpenRouter model found for feature={feature}. Using default.")
        return "openai/gpt-5.2-chat"
    
    def format_request(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Format a request for the OpenRouter API
        
        Args:
            model: OpenRouter model ID
            prompt: User prompt/message
            system_prompt: Optional system prompt for context
            
        Returns:
            Dict containing formatted request payload
        """
        messages = []
        
        # Add system prompt if provided
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        # Add user prompt
        messages.append({
            "role": "user",
            "content": prompt
        })
        
        request_payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2048,  # Reduced from 2048 to use fewer credits
        }
        
        return request_payload
    
    async def call_openrouter(
        self,
        api_key: str,
        provider: str,
        feature: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Call the OpenRouter API with a prompt
        
        Args:
            api_key: OpenRouter API key
            provider: Provider name (gemini, openai, anthropic)
            feature: Feature name (chat, flashcard, mcq, etc.)
            prompt: User prompt/message
            system_prompt: Optional system prompt for context
            stream: Whether to stream the response (not implemented yet)
            
        Returns:
            Dict containing:
                - success: bool indicating if call succeeded
                - content: Generated text content (if success)
                - error: Error message (if not success)
                - tokens_used: Token count
        """
        try:
            # Get the appropriate model for this provider and feature
            model = self.get_model_id(provider, feature)
            
            # Format the request
            request_payload = self.format_request(model, prompt, system_prompt)
            
            # Prepare headers
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://vaidyaai.com",  # Optional: for rankings
                "X-Title": "VaidyaAI Medical Platform"  # Optional: for rankings
            }
            
            url = f"{self.BASE_URL}/chat/completions"
            
            logger.info(f"Calling OpenRouter API: {model}")
            
            # Make the API call
            response = await self.client.post(
                url,
                headers=headers,
                json=request_payload
            )
            
            # Check for HTTP errors
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"OpenRouter API error: {response.status_code} - {error_detail}")
                
                # Parse error message if possible
                try:
                    error_json = response.json()
                    error_message = error_json.get("error", {}).get("message", error_detail)
                    error_code = error_json.get("error", {}).get("code", "")
                except:
                    error_message = error_detail
                    error_code = ""
                
                # Check if this is a token limit error
                is_token_limit_error = (
                    "token" in error_message.lower() and 
                    ("limit" in error_message.lower() or 
                     "maximum" in error_message.lower() or
                     "context length" in error_message.lower() or
                     "too long" in error_message.lower())
                ) or error_code == "context_length_exceeded"
                
                return {
                    "success": False,
                    "error": f"OpenRouter API error ({response.status_code}): {error_message}",
                    "tokens_used": 0,
                    "is_token_limit_error": is_token_limit_error
                }
            
            # Parse response
            response_data = response.json()
            
            # Extract generated content
            # OpenRouter uses OpenAI-compatible format
            choices = response_data.get("choices", [])
            
            if not choices:
                logger.warning("OpenRouter API returned no choices")
                return {
                    "success": False,
                    "error": "No response generated by OpenRouter",
                    "tokens_used": 0
                }
            
            # Get the first choice
            choice = choices[0]
            message = choice.get("message", {})
            generated_text = message.get("content", "")
            
            # Get token usage
            usage = response_data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)
            
            # If no token count, estimate based on text length
            if tokens_used == 0:
                # Rough estimate: 1 token ≈ 4 characters
                tokens_used = len(prompt) // 4 + len(generated_text) // 4
            
            logger.info(f"OpenRouter API call successful. Model: {model}, Tokens used: {tokens_used}")
            
            return {
                "success": True,
                "content": generated_text,
                "tokens_used": tokens_used,
                "model": model
            }
            
        except httpx.TimeoutException:
            logger.error("OpenRouter API call timed out")
            return {
                "success": False,
                "error": "Request timed out",
                "tokens_used": 0,
                "is_token_limit_error": False
            }
        except httpx.RequestError as e:
            logger.error(f"OpenRouter API request error: {str(e)}")
            return {
                "success": False,
                "error": f"Network error: {str(e)}",
                "tokens_used": 0,
                "is_token_limit_error": False
            }
        except Exception as e:
            logger.error(f"Unexpected error calling OpenRouter API: {str(e)}")
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
                "tokens_used": 0,
                "is_token_limit_error": False
            }
    
    async def call_openrouter_streaming(
        self,
        api_key: str,
        provider: str,
        feature: str,
        prompt: str,
        system_prompt: Optional[str] = None
    ) -> AsyncIterator[str]:
        """
        Call the OpenRouter API with streaming response
        
        Args:
            api_key: OpenRouter API key
            provider: Provider name (gemini, openai, anthropic)
            feature: Feature name (chat, flashcard, mcq, etc.)
            prompt: User prompt/message
            system_prompt: Optional system prompt for context
            
        Yields:
            Text chunks as they arrive from the API
        """
        try:
            # Get the appropriate model
            model = self.get_model_id(provider, feature)
            
            # Format the request
            request_payload = self.format_request(model, prompt, system_prompt)
            request_payload["stream"] = True
            
            # Prepare headers
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://vaidyaai.com",
                "X-Title": "VaidyaAI Medical Platform"
            }
            
            url = f"{self.BASE_URL}/chat/completions"
            
            logger.info(f"Calling OpenRouter API (streaming): {model}")
            
            # Make the streaming API call
            async with self.client.stream(
                "POST",
                url,
                headers=headers,
                json=request_payload
            ) as response:
                
                # Check for HTTP errors
                if response.status_code != 200:
                    error_detail = await response.aread()
                    logger.error(f"OpenRouter streaming API error: {response.status_code}")
                    yield f"Error: OpenRouter API returned status {response.status_code}"
                    return
                
                # Process streaming response
                async for line in response.aiter_lines():
                    # Skip empty lines
                    if not line.strip():
                        continue
                    
                    # SSE format: "data: {...}"
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        
                        # Check for end of stream
                        if data_str == "[DONE]":
                            break
                        
                        try:
                            data = json.loads(data_str)
                            
                            # Extract text from the chunk
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse streaming chunk: {data_str}")
                            continue
                
                logger.info("OpenRouter streaming API call completed")
                
        except httpx.TimeoutException:
            logger.error("OpenRouter streaming API call timed out")
            yield "Error: Request timed out"
        except httpx.RequestError as e:
            logger.error(f"OpenRouter streaming API request error: {str(e)}")
            yield f"Error: Network error - {str(e)}"
        except Exception as e:
            logger.error(f"Unexpected error in OpenRouter streaming: {str(e)}")
            yield f"Error: {str(e)}"
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Singleton instance
_openrouter_provider: Optional[OpenRouterProvider] = None


def get_openrouter_provider() -> OpenRouterProvider:
    """
    Get or create the singleton OpenRouter provider instance
    
    Returns:
        OpenRouterProvider instance
    """
    global _openrouter_provider
    
    if _openrouter_provider is None:
        _openrouter_provider = OpenRouterProvider()
    
    return _openrouter_provider
