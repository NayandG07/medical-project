"""
Setup script for document upload feature
Run this after installing dependencies to initialize the feature
"""
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()


async def setup_documents_feature():
    """Initialize document upload feature"""
    print("🚀 Setting up Document Upload Feature...")
    
    # Initialize Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        return
    
    supabase: Client = create_client(supabase_url, supabase_key)
    print("✅ Connected to Supabase")
    
    # Check if tables exist
    try:
        result = supabase.table("documents").select("id").limit(1).execute()
        print("✅ Documents table exists")
    except Exception as e:
        print(f"⚠️  Documents table not found. Please run the migration SQL:")
        print("   backend/database/migrations/add_documents_tables.sql")
        print(f"   Error: {str(e)}")
        return
    
    # Check storage bucket
    try:
        buckets = supabase.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        
        if "documents" not in bucket_names:
            print("📦 Creating 'documents' storage bucket...")
            supabase.storage.create_bucket("documents", {"public": False})
            print("✅ Storage bucket created")
        else:
            print("✅ Storage bucket exists")
    except Exception as e:
        print(f"⚠️  Could not check/create storage bucket: {str(e)}")
        print("   Please create it manually in Supabase Dashboard")
    
    # Set default system flags - PLAN-BASED configuration
    plans = ["free", "student", "pro"]
    features = ["chat", "mcq", "flashcard", "explain", "highyield"]
    
    # Default retention days per plan
    default_retention = {
        "free": 7,
        "student": 14,
        "pro": 30
    }
    
    # Default document uploads per day per plan
    default_doc_uploads = {
        "free": 3,
        "student": 10,
        "pro": 50
    }
    
    # Default feature limits per day per plan
    default_feature_limits = {
        "free": {
            "chat": 20,
            "mcq": 10,
            "flashcard": 10,
            "explain": 5,
            "highyield": 5
        },
        "student": {
            "chat": 100,
            "mcq": 50,
            "flashcard": 50,
            "explain": 30,
            "highyield": 30
        },
        "pro": {
            "chat": 500,
            "mcq": 200,
            "flashcard": 200,
            "explain": 100,
            "highyield": 100
        }
    }
    
    print("\n📝 Setting default plan-based configuration...")
    
    for plan in plans:
        print(f"\n  🎯 Configuring {plan.upper()} plan:")
        
        # Document retention days per plan
        retention_flag = f"document_retention_{plan}"
        try:
            existing = supabase.table("system_flags").select("*").eq("flag_name", retention_flag).execute()
            if not existing.data:
                supabase.table("system_flags").insert({
                    "flag_name": retention_flag,
                    "flag_value": str(default_retention[plan])
                }).execute()
                print(f"    ✅ Document retention: {default_retention[plan]} days")
            else:
                print(f"    ℹ️  Document retention already set: {existing.data[0]['flag_value']} days")
        except Exception as e:
            print(f"    ⚠️  Could not set {retention_flag}: {str(e)}")
        
        # Document uploads per day per plan
        uploads_flag = f"document_uploads_daily_{plan}"
        try:
            existing = supabase.table("system_flags").select("*").eq("flag_name", uploads_flag).execute()
            if not existing.data:
                supabase.table("system_flags").insert({
                    "flag_name": uploads_flag,
                    "flag_value": str(default_doc_uploads[plan])
                }).execute()
                print(f"    ✅ Document uploads: {default_doc_uploads[plan]}/day")
            else:
                print(f"    ℹ️  Document uploads already set: {existing.data[0]['flag_value']}/day")
        except Exception as e:
            print(f"    ⚠️  Could not set {uploads_flag}: {str(e)}")
        
        # Feature limits per day per plan
        for feature in features:
            limit_flag = f"{feature}_daily_limit_{plan}"
            try:
                existing = supabase.table("system_flags").select("*").eq("flag_name", limit_flag).execute()
                if not existing.data:
                    supabase.table("system_flags").insert({
                        "flag_name": limit_flag,
                        "flag_value": str(default_feature_limits[plan][feature])
                    }).execute()
                    print(f"    ✅ {feature.capitalize()}: {default_feature_limits[plan][feature]}/day")
                else:
                    print(f"    ℹ️  {feature.capitalize()} already set: {existing.data[0]['flag_value']}/day")
            except Exception as e:
                print(f"    ⚠️  Could not set {limit_flag}: {str(e)}")
    
    print("\n✨ Document Upload Feature Setup Complete!")
    print("\n📚 Next steps:")
    print("  1. Install tesseract-ocr for image OCR (optional)")
    print("  2. Configure rate limits in admin panel: /admin/rate-limits")
    print("  3. Test upload at: /documents")
    print("\n💡 Default limits configured:")
    print("  • Free: 7 days retention, 3 uploads/day")
    print("  • Student: 14 days retention, 10 uploads/day")
    print("  • Pro: 30 days retention, 50 uploads/day")


if __name__ == "__main__":
    asyncio.run(setup_documents_feature())
