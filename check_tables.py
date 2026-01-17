import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv(dotenv_path="backend/.env")

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print(f"Supabase URL or Key missing in environment (URL: {url}, Key: {'set' if key else 'not set'})")
    exit(1)

supabase: Client = create_client(url, key)

tables = ["study_plan_entries", "study_goals", "performance_metrics", "ai_recommendations", "study_streaks"]

for table in tables:
    try:
        response = supabase.table(table).select("count", count="exact").limit(0).execute()
        print(f"Table '{table}' exists.")
    except Exception as e:
        print(f"Table '{table}' error: {e}")
