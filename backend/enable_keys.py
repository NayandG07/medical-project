
import os
from dotenv import load_dotenv
from supabase import create_client

def enable_key():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)
    
    response = supabase.table("api_keys") \
        .update({"status": "active"}) \
        .eq("feature", "chat") \
        .execute()
    
    print(f"Enabled {len(response.data)} keys for chat.")

if __name__ == "__main__":
    enable_key()
