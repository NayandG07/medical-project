"""
Run SQL migration directly using Supabase REST API
"""
import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    exit(1)

# Read migration SQL
migration_path = os.path.join(os.path.dirname(__file__), 'database', 'migrations', 'add_fallback_locks_column.sql')
with open(migration_path, 'r') as f:
    sql = f.read()

print("Applying migration: add_fallback_locks_column.sql")
print("-" * 60)

# Try to execute using Supabase REST API
# Note: This requires the SQL to be executed via the database directly
# The Python client doesn't support raw SQL execution

# Alternative: Use psycopg2 if available
try:
    import psycopg2
    from urllib.parse import urlparse
    
    # Parse connection string from Supabase URL
    # Format: postgresql://[user[:password]@][netloc][:port][/dbname]
    
    # For Supabase, we need to construct the connection string
    # This is typically not exposed directly, so we'll print instructions instead
    
    print("To apply this migration, you have two options:\n")
    print("Option 1: Use Supabase Dashboard")
    print("  1. Go to https://app.supabase.com")
    print("  2. Select your project")
    print("  3. Go to SQL Editor")
    print("  4. Paste the following SQL:\n")
    print(sql)
    print("\n" + "-" * 60)
    print("\nOption 2: Use psql command line")
    print("  Get your database connection string from Supabase Dashboard")
    print("  Settings > Database > Connection String")
    print("  Then run: psql <connection_string> -f database/migrations/add_fallback_locks_column.sql")
    
except ImportError:
    print("psycopg2 not installed. Please apply migration manually:")
    print("\n1. Go to Supabase Dashboard > SQL Editor")
    print("2. Paste the following SQL:\n")
    print(sql)
