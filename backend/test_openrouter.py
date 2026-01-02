"""Test OpenRouter integration"""
import asyncio
from services.providers.openrouter import get_openrouter_provider

async def test():
    provider = get_openrouter_provider()
    
    # Test with a dummy API key
    result = await provider.call_openrouter(
        api_key="test_key",
        provider="gemini",
        feature="chat",
        prompt="Hello",
        system_prompt="You are a helpful assistant"
    )
    
    print("Result:", result)

if __name__ == "__main__":
    asyncio.run(test())
