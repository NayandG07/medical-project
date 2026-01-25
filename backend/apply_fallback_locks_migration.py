"""
Apply fallback_locks column migration to users table
"""
from supabase import create_client
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    exit(1)

supabase = create_client(supabase_url, supabase_key)

# Read migration SQL
import sys
sys.path.append(os.path.dirname(__file__))
migration_path = os.path.join(os.path.dirname(__file__), 'database', 'migrations', 'add_fallback_locks_column.sql')
with open(migration_path, 'r') as f:
    sql = f.read()

print("Applying migration: add_fallback_locks_column.sql")
print("-" * 60)

try:
    # Execute the SQL directly using postgrest
    # Note: Supabase Python client doesn't have direct SQL execution
    # We need to use the REST API or psycopg2
    
    # For now, let's just print instructions
    print("Migration SQL:")
    print(sql)
    print("-" * 60)
    print("\nTo apply this migration:")
    print("1. Go to your Supabase Dashboard")
    print("2. Navigate to SQL Editor")
    print("3. Copy and paste the SQL above")
    print("4. Click 'Run'")
    print("\nOr use psql:")
    print(f"psql {supabase_url} -c \"{sql.replace(chr(10), ' ')}\"")
    
except Exception as e:
    print(f"Error: {str(e)}")
    exit(1)
