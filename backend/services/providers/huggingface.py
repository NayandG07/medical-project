"""
Hugging Face Provider
Uses Hugging Face Inference API for medical-specific open-source models
No model downloads required - all inference happens via API
Requirements: Medical model fallback, cost optimization
"""
import os
import httpx
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import logging
import json

load_dotenv()
logger = logging.getLogger(__name__)


class HuggingFaceProvider:
    """Provider for Hugging Face Inference API"""
    
    # Medical-specific models available on Hugging Face Router
    # Updated for router.huggingface.co/v1 compatibility
    # Using latest versions and best medical models available
    MEDICAL_MODELS = {
        # # Medical reasoning - Meditron-70B-chat (chat-tuned version for router compatibility)
        # "chat": "malhajar/meditron-70b-chat",  # Chat-tuned Meditron-70B
        # "clinical": "malhajar/meditron-70b-chat",  # Clinical reasoning
        # "osce": "malhajar/meditron-70b-chat",  # OSCE scenarios
        # "explain": "malhajar/meditron-70b-chat",  # Medical explanations
        # "highyield": "malhajar/meditron-70b-chat", # Summarization

        # Medical reasoning - Meditron-70B-chat (chat-tuned version for router compatibility)
        "chat": "aaditya/OpenBioLLM-Llama3-8B",  # Chat-tuned Meditron-70B
        "clinical": "aaditya/OpenBioLLM-Llama3-8B",  # Clinical reasoning
        "osce": "aaditya/OpenBioLLM-Llama3-8B",  # OSCE scenarios
        "explain": "aaditya/OpenBioLLM-Llama3-8B",  # Medical explanations
        "highyield": "aaditya/OpenBioLLM-Llama3-8B", # Summarization

        # Content generation - Using Llama-3.1 (newer than 3-8B)
        "flashcard": "meta-llama/Llama-3.1-8B-Instruct",  # Upgraded from Llama-3-8B
        "mcq": "meta-llama/Llama-3.1-8B-Instruct",  # Upgraded from Llama-3-8B
        "map": "meta-llama/Llama-3.1-8B-Instruct",  # Concept maps - upgraded
        
        # Specialized medical models
        "safety": "aaditya/OpenBioLLM-Llama3-8B",  # Safety check - medical safety model
        "image": "microsoft/llava-med-v1.5-mistral-7b",  # Medical image understanding - upgraded
        
        # Embeddings
        "embedding": "BAAI/bge-small-en-v1.5",  # RAG embeddings
    }
    
    def __init__(self):
        """Initialize Hugging Face provider"""
        self.api_key = os.getenv("HUGGINGFACE_API_KEY")
        # Router for chat models, direct API for base models
        self.router_url = "https://router.huggingface.co/v1"
        self.inference_url = "https://api-inference.huggingface.co/models"
        
        if not self.api_key:
            logger.warning("HUGGINGFACE_API_KEY not set - Hugging Face provider will not work")
    
    def _is_chat_model(self, model: str) -> bool:
        """Check if model supports chat format"""
        # Chat-compatible models (instruct/chat variants)
        chat_keywords = ["instruct", "chat", "llama-3", "openbiollm"]
        return any(keyword in model.lower() for keyword in chat_keywords)
    
    async def call_huggingface(
        self,
        feature: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Call Hugging Face Inference API
        Automatically detects if model is chat or completion type
        
        Args:
            feature: Feature name (chat, flashcard, etc.)
            prompt: User prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            
        Returns:
            Dict with success, content, error, tokens_used
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "Hugging Face API key not configured",
                "content": "",
                "tokens_used": 0
            }
        
        # Get model for this feature
        model = self.MEDICAL_MODELS.get(feature, self.MEDICAL_MODELS["chat"])
        
        logger.info(f"Calling Hugging Face model: {model} for feature: {feature}")
        
        try:
            # All models now use router (chat-compatible)
            url = f"{self.router_url}/chat/completions"
            
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # Make request
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Extract generated text from OpenAI-compatible response
                    if "choices" in result and len(result["choices"]) > 0:
                        generated_text = result["choices"][0]["message"]["content"]
                    else:
                        generated_text = str(result)
                    
                    tokens_used = result.get("usage", {}).get("total_tokens", 0)
                    
                    # If tokens not provided, estimate
                    if tokens_used == 0:
                        tokens_used = len(prompt + generated_text) // 4
                    
                    logger.info(f"Hugging Face call succeeded. Model: {model}, Tokens: ~{tokens_used}")
                    
                    return {
                        "success": True,
                        "content": generated_text.strip(),
                        "error": None,
                        "tokens_used": tokens_used,
                        "model": model,
                        "provider": "huggingface"
                    }
                else:
                    error_msg = f"Hugging Face API error: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    
                    return {
                        "success": False,
                        "error": error_msg,
                        "content": "",
                        "tokens_used": 0,
                        "model": model,
                        "provider": "huggingface"
                    }
                    
        except httpx.TimeoutException:
            error_msg = "Hugging Face API timeout"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "content": "",
                "tokens_used": 0,
                "model": model,
                "provider": "huggingface"
            }
        except Exception as e:
            error_msg = f"Hugging Face API error: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "content": "",
                "tokens_used": 0,
                "model": model,
                "provider": "huggingface"
            }
    
    async def generate_embedding(self, text: str) -> Dict[str, Any]:
        """
        Generate embeddings using Hugging Face model
        
        Args:
            text: Text to embed
            
        Returns:
            Dict with success, embedding, error
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "Hugging Face API key not configured",
                "embedding": None
            }
        
        model = self.MEDICAL_MODELS["embedding"]
        
        try:
            url = f"{self.base_url}/{model}"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {"inputs": text}
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code == 200:
                    embedding = response.json()
                    
                    return {
                        "success": True,
                        "embedding": embedding,
                        "error": None,
                        "model": model
                    }
                else:
                    error_msg = f"Embedding API error: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    
                    return {
                        "success": False,
                        "error": error_msg,
                        "embedding": None
                    }
                    
        except Exception as e:
            error_msg = f"Embedding API error: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "embedding": None
            }
    async def health_check(self, feature: str = "chat") -> Dict[str, Any]:
        """
        Perform a health check on Hugging Face models
        
        Args:
            feature: Feature to test (default: chat)
            
        Returns:
            Dict with success, model, response_time_ms, error
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "Hugging Face API key not configured",
                "model": None,
                "response_time_ms": 0
            }
        
        model = self.MEDICAL_MODELS.get(feature, self.MEDICAL_MODELS["chat"])
        
        logger.info(f"Performing health check on Hugging Face model: {model}")
        
        import time
        start_time = time.time()
        
        try:
            # Simple test prompt
            test_prompt = "What is diabetes?"
            
            url = f"{self.base_url}/{model}"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "inputs": test_prompt,
                "parameters": {
                    "max_new_tokens": 50,  # Small response for health check
                    "temperature": 0.7,
                    "return_full_text": False
                }
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                response_time = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    logger.info(f"Hugging Face health check passed for {model} ({response_time}ms)")
                    
                    return {
                        "success": True,
                        "model": model,
                        "response_time_ms": response_time,
                        "error": None
                    }
                elif response.status_code == 503:
                    # Model is loading (cold start)
                    logger.warning(f"Hugging Face model {model} is loading (cold start)")
                    
                    return {
                        "success": False,
                        "model": model,
                        "response_time_ms": response_time,
                        "error": "Model loading (cold start)",
                        "is_loading": True
                    }
                else:
                    error_msg = f"Health check failed: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    
                    return {
                        "success": False,
                        "model": model,
                        "response_time_ms": response_time,
                        "error": error_msg
                    }
                    
        except httpx.TimeoutException:
            response_time = int((time.time() - start_time) * 1000)
            error_msg = "Health check timeout"
            logger.error(error_msg)
            
            return {
                "success": False,
                "model": model,
                "response_time_ms": response_time,
                "error": error_msg
            }
        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            error_msg = f"Health check error: {str(e)}"
            logger.error(error_msg)
            
            return {
                "success": False,
                "model": model,
                "response_time_ms": response_time,
                "error": error_msg
            }


# Singleton instance
_huggingface_provider: Optional[HuggingFaceProvider] = None


def get_huggingface_provider() -> HuggingFaceProvider:
    """Get or create singleton Hugging Face provider instance"""
    global _huggingface_provider
    
    if _huggingface_provider is None:
        _huggingface_provider = HuggingFaceProvider()
    
    return _huggingface_provider
