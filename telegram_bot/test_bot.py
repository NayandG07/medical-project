"""
Quick test script to verify Telegram bot is working
"""
import os
import asyncio
from dotenv import load_dotenv
from telegram import Bot

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

async def test_bot():
    """Test if bot can send a message"""
    try:
        bot = Bot(token=TELEGRAM_BOT_TOKEN)
        
        # Get bot info
        me = await bot.get_me()
        print(f"✅ Bot connected: @{me.username}")
        print(f"   Bot ID: {me.id}")
        print(f"   Bot Name: {me.first_name}")
        
        # Try to send a test message
        message = await bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text="🤖 Test message from VaidyaAI bot!\n\nIf you see this, the bot is working correctly."
        )
        print(f"\n✅ Message sent successfully!")
        print(f"   Message ID: {message.message_id}")
        print(f"   Chat ID: {message.chat.id}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_bot())
