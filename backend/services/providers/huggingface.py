"""
Hugging Face Provider
Uses Hugging Face Inference API for medical-specific open-source models
No model downloads required - all inference happens via API
Requirements: Medical model fallback, cost optimization
"""
import os
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)


class HuggingFaceProvider:
    """Provider for Hugging Face Inference API"""
    
    # Medical-specific models available on Hugging Face
    MEDICAL_MODELS = {
        # Medical reasoning - Med42-70B via Featherless AI provider (Router)
        "chat": "m42-health/Llama3-Med42-70B:featherless-ai",
        "clinical": "m42-health/Llama3-Med42-70B:featherless-ai",
        "osce": "m42-health/Llama3-Med42-70B:featherless-ai",
        "explain": "m42-health/Llama3-Med42-70B:featherless-ai",
        "highyield": "m42-health/Llama3-Med42-70B:featherless-ai",
        "mcq": "m42-health/Llama3-Med42-70B:featherless-ai",

        # Content generation - Using Llama-3.1
        "flashcard": "meta-llama/Llama-3.1-8B-Instruct",
        "map": "meta-llama/Llama-3.1-8B-Instruct",
        
        # Specialized medical models
        "safety": "m42-health/Llama3-Med42-70B:featherless-ai",
        # "image": "microsoft/llava-med-v1.5-mistral-7b", # Image-text-to-text medical vision
        "image": "Qwen/Qwen3.5-397B-A17B", # Image-text-to-text
        # "image": "Qwen/Qwen3-VL-235B-A22B-Thinking", # Image-to-text vision
        
        # Embeddings - Using Qwen3 Embedding (4096 dimensions, superior semantic understanding)
        "embedding": "Qwen/Qwen3-Embedding-8B",
    }
    
    def __init__(self):
        """Initialize Hugging Face provider"""
        self.api_key = os.getenv("HUGGINGFACE_API_KEY")
        # Router endpoint for chat models (OpenAI-compatible)
        self.router_url = "https://router.huggingface.co/v1"
        # Inference API endpoint for embeddings
        self.inference_url = "https://api-inference.huggingface.co/models"
        
        # Initialize InferenceClient for embeddings
        self.inference_client = None
        if self.api_key:
            try:
                from huggingface_hub import InferenceClient
                self.inference_client = InferenceClient(token=self.api_key)
                logger.info("HuggingFace InferenceClient initialized")
            except ImportError:
                logger.warning("huggingface_hub not installed. Install with: pip install huggingface_hub")
        else:
            logger.warning("HUGGINGFACE_API_KEY not set - Hugging Face provider will not work")
    
    async def call_huggingface(
        self,
        feature: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.9,
        use_free_api: bool = False,
        image_data: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Call Hugging Face Router API (OpenAI-compatible format) or free Inference API
        
        Args:
            feature: Feature name (chat, flashcard, etc.)
            prompt: User prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            use_free_api: If True, use free Inference API instead of Router
            image_data: Optional base64-encoded image data for vision models
            
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
        
        model = self.MEDICAL_MODELS.get(feature, self.MEDICAL_MODELS["chat"])
        logger.info(f"Calling Hugging Face model: {model} for feature: {feature} (free_api={use_free_api}, has_image={image_data is not None})")
        
        try:
            import httpx
            
            # Try Router API first (paid, faster)
            if not use_free_api:
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                
                # Build user message with optional image
                if image_data and feature == "image":
                    # Vision model - include image in message
                    messages.append({
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_data}"
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    })
                else:
                    # Text-only message
                    messages.append({"role": "user", "content": prompt})
                
                url = f"{self.router_url}/chat/completions"
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": False
                }
                
                # Use longer timeout for image models (they're larger and slower)
                timeout_seconds = 120.0 if feature == "image" else 60.0
                async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    
                    # If 402 (payment required), fall back to free API
                    if response.status_code == 402:
                        logger.warning("Router API credits depleted, falling back to free Inference API")
                        return await self.call_huggingface(
                            feature=feature,
                            prompt=prompt,
                            system_prompt=system_prompt,
                            max_tokens=max_tokens,
                            temperature=temperature,
                            use_free_api=True
                        )
                    
                    if response.status_code == 200:
                        result = response.json()
                        
                        if "choices" in result and len(result["choices"]) > 0:
                            generated_text = result["choices"][0]["message"]["content"]
                            tokens_used = result.get("usage", {}).get("total_tokens", 0)
                            if tokens_used == 0:
                                tokens_used = len(prompt + generated_text) // 4
                        else:
                            generated_text = str(result)
                            tokens_used = len(prompt + generated_text) // 4
                        
                        if feature == "clinical":
                            logger.info(f"Full HF response length: {len(generated_text)} chars")
                            logger.debug(f"Full HF response: {generated_text}")
                        
                        logger.info(f"Hugging Face Router call succeeded. Model: {model}, Tokens: ~{tokens_used}")
                        
                        return {
                            "success": True,
                            "content": generated_text.strip(),
                            "error": None,
                            "tokens_used": tokens_used,
                            "model": model,
                            "provider": "huggingface"
                        }
                    else:
                        error_msg = f"Hugging Face Router API error: {response.status_code} - {response.text}"
                        logger.error(error_msg)
                        
                        return {
                            "success": False,
                            "error": error_msg,
                            "content": "",
                            "tokens_used": 0,
                            "model": model,
                            "provider": "huggingface"
                        }
            
            # Use free Inference API (slower, rate-limited, but free)
            else:
                if not self.inference_client:
                    return {
                        "success": False,
                        "error": "Inference client not initialized",
                        "content": "",
                        "tokens_used": 0
                    }
                
                # For free API, use smaller/free models that support chat
                free_models = {
                    "chat": "microsoft/Phi-3-mini-4k-instruct",
                    "clinical": "microsoft/Phi-3-mini-4k-instruct",
                    "flashcard": "microsoft/Phi-3-mini-4k-instruct",
                    "mcq": "microsoft/Phi-3-mini-4k-instruct",
                    "explain": "microsoft/Phi-3-mini-4k-instruct",
                    "highyield": "microsoft/Phi-3-mini-4k-instruct",
                    "osce": "microsoft/Phi-3-mini-4k-instruct",
                }
                free_model = free_models.get(feature, "microsoft/Phi-3-mini-4k-instruct")
                
                logger.info(f"Using free Inference API with model: {free_model}")
                
                # Build messages for chat completion
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})
                
                # Call chat completion
                response = self.inference_client.chat_completion(
                    messages=messages,
                    model=free_model,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                
                # Extract generated text
                if hasattr(response, 'choices') and len(response.choices) > 0:
                    generated_text = response.choices[0].message.content
                else:
                    generated_text = str(response)
                
                tokens_used = len(prompt + generated_text) // 4
                
                logger.info(f"Free Inference API call succeeded. Model: {free_model}, Tokens: ~{tokens_used}")
                
                return {
                    "success": True,
                    "content": generated_text.strip(),
                    "error": None,
                    "tokens_used": tokens_used,
                    "model": free_model,
                    "provider": "huggingface-free"
                }
                    
        except Exception as e:
            error_msg = f"Hugging Face API error: {str(e)}"
            logger.error(error_msg)
            logger.exception("Full HuggingFace error traceback:")
            return {
                "success": False,
                "error": error_msg,
                "content": "",
                "tokens_used": 0,
                "model": model,
                "provider": "huggingface"
            }
    
    async def generate_embedding(self, text: str, prepend_instruction: bool = True) -> Dict[str, Any]:
        """
        Generate embeddings using Hugging Face Inference API
        
        Args:
            text: Text to embed
            prepend_instruction: Whether to prepend BGE instruction for queries (default: True)
            
        Returns:
            Dict with success, embedding, error, model
        """
        if not self.api_key or not self.inference_client:
            return {
                "success": False,
                "error": "Hugging Face API key not configured or InferenceClient not available",
                "embedding": None
            }
        
        model = self.MEDICAL_MODELS["embedding"]
        
        try:
            # For Qwen models, no special instruction needed
            # For BGE models, prepend instruction to queries for better retrieval
            text_to_embed = text
            
            if prepend_instruction:
                if "bge" in model.lower():
                    text_to_embed = f"Represent this sentence for searching relevant passages: {text}"
                # Qwen models don't need special instructions
            
            logger.info(f"Generating embedding with model: {model}")
            
            try:
                # Try Router API first
                embedding = self.inference_client.feature_extraction(
                    text=text_to_embed,
                    model=model
                )
            except Exception as router_error:
                # If Router API fails (402 payment required), use free Inference API
                if "402" in str(router_error) or "Payment Required" in str(router_error):
                    logger.warning("Router API credits depleted for embeddings, using free model")
                    # Use a free embedding model
                    free_embedding_model = "sentence-transformers/all-MiniLM-L6-v2"
                    logger.info(f"Using free embedding model: {free_embedding_model}")
                    embedding = self.inference_client.feature_extraction(
                        text=text_to_embed,
                        model=free_embedding_model
                    )
                    model = free_embedding_model
                else:
                    raise router_error
            
            # Convert to list if it's a numpy array or tensor
            if hasattr(embedding, 'tolist'):
                embedding = embedding.tolist()
            
            # Handle nested lists - feature_extraction often returns [[...]]
            while isinstance(embedding, list) and len(embedding) > 0 and isinstance(embedding[0], list):
                embedding = embedding[0]
            
            # Ensure it's a flat list of numbers
            if not isinstance(embedding, list) or not all(isinstance(x, (int, float)) for x in embedding):
                raise ValueError(f"Invalid embedding format: {type(embedding)}")
            
            logger.info(f"Embedding generated successfully, dimension: {len(embedding) if embedding else 0}")
            
            return {
                "success": True,
                "embedding": embedding,
                "error": None,
                "model": model
            }
                    
        except Exception as e:
            error_msg = f"Embedding API error: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "embedding": None,
                "model": model
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
        import httpx
        start_time = time.time()
        
        try:
            url = f"{self.router_url}/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": "What is diabetes?"}],
                "max_tokens": 50,
                "temperature": 0.7
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
                    
        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "model": model,
                "response_time_ms": response_time,
                "error": f"Health check error: {str(e)}"
            }


# Singleton instance
_huggingface_provider: Optional[HuggingFaceProvider] = None


def get_huggingface_provider() -> HuggingFaceProvider:
    """Get or create singleton Hugging Face provider instance"""
    global _huggingface_provider
    
    if _huggingface_provider is None:
        _huggingface_provider = HuggingFaceProvider()
    
    return _huggingface_provider
