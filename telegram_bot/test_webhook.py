"""
Test webhook endpoint
"""
import asyncio
import aiohttp

async def test_webhook():
    """Send a test webhook to the bot"""
    url = "http://localhost:8001/webhook"
    
    payload = {
        "event": "model_timeout",
        "feature": "osce",
        "model": "m42-health/Llama3-Med42-70B",
        "provider": "huggingface",
        "timeout_seconds": 180,
        "timestamp": "2026-03-03T22:20:00Z"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as response:
            result = await response.json()
            print(f"Status: {response.status}")
            print(f"Response: {result}")

if __name__ == "__main__":
    asyncio.run(test_webhook())
