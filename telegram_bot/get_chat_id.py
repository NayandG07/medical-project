"""
Get your Telegram Chat ID
Run this after sending a message to your bot
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

if not BOT_TOKEN:
    print("❌ Error: TELEGRAM_BOT_TOKEN not found in environment variables")
    print("Please set it in telegram_bot/.env file")
    exit(1)

print("="*80)
print("Getting Telegram Chat ID")
print("="*80)
print("\n1. First, send a message to your bot: @discordroutedlogsbot")
print("2. Then run this script\n")

url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"

try:
    response = requests.get(url)
    data = response.json()
    
    if data.get("ok") and data.get("result"):
        print("✓ Found messages!\n")
        for update in data["result"]:
            if "message" in update:
                chat = update["message"]["chat"]
                print(f"Chat ID: {chat['id']}")
                print(f"Chat Type: {chat['type']}")
                if "username" in chat:
                    print(f"Username: @{chat['username']}")
                if "first_name" in chat:
                    print(f"Name: {chat['first_name']}")
                print("\n" + "-"*80 + "\n")
        
        print("Copy the Chat ID and add it to telegram_bot/.env:")
        print("TELEGRAM_CHAT_ID=<your_chat_id>")
    else:
        print("❌ No messages found. Send a message to your bot first!")
        print(f"\nBot: @discordroutedlogsbot")
        print(f"Or visit: https://t.me/discordroutedlogsbot")

except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*80)
