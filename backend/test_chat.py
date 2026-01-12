
import asyncio
import os
from dotenv import load_dotenv
from services.chat import get_chat_service
from supabase import create_client

async def test_chat():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)
    
    chat_service = get_chat_service(supabase)
    
    # Use a dummy user and session (check if you have one or create one)
    user_id = "00000000-0000-0000-0000-000000000000" # Placeholder
    # Try to find a real user id from the database if possible
    try:
        users = supabase.table("users").select("id").limit(1).execute()
        if users.data:
            user_id = users.data[0]["id"]
    except:
        pass
    
    print(f"Using user_id: {user_id}")
    
    try:
        # Create a test session
        session = await chat_service.create_session(user_id, "Test Session")
        session_id = session["id"]
        print(f"Created session: {session_id}")
        
        print("Sending message 'Hello'...")
        response = await chat_service.send_message(
            user_id=user_id,
            session_id=session_id,
            message="Hello",
            role="user"
        )
        print("Response received:")
        print(response)
    except Exception as e:
        print(f"Error during chat: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_chat())
