
import os
from dotenv import load_dotenv
from supabase import create_client

def check_keys():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)
    
    response = supabase.table("api_keys").select("*").execute()
    print(f"Found {len(response.data)} keys:")
    for k in response.data:
        print(f"ID: {k['id']}, Provider: {k['provider']}, Feature: {k['feature']}, Status: {k['status']}")

if __name__ == "__main__":
    check_keys()
