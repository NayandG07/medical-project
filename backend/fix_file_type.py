"""
Fix file_type constraint in documents table
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def fix_file_type_constraint():
    """Fix the file_type constraint to allow proper MIME types"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        return
    
    supabase: Client = create_client(supabase_url, supabase_key)
    print("✅ Connected to Supabase")
    
    # Read and execute the SQL migration
    with open("database/migrations/fix_file_type_constraint.sql", "r") as f:
        sql = f.read()
    
    try:
        # Execute via RPC or direct SQL
        print("🔧 Fixing file_type constraint...")
        print("\n⚠️  Please run this SQL manually in Supabase SQL Editor:")
        print("=" * 60)
        print(sql)
        print("=" * 60)
        print("\nOr run: psql <your-connection-string> < database/migrations/fix_file_type_constraint.sql")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    fix_file_type_constraint()
