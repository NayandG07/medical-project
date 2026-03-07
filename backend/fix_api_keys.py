"""
Fix API keys for clinical and OSCE features
"""
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client
from services.encryption import get_encryption_service

load_dotenv()

async def fix_api_keys():
    """Add or update API keys for clinical and OSCE features"""
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")
    huggingface_key = os.getenv("HUGGINGFACE_API_KEY")
    
    supabase = create_client(supabase_url, supabase_service_key)
    encryption_service = get_encryption_service()
    
    print("Checking existing API keys...")
    
    # Check existing keys
    response = supabase.table("api_keys").select("*").execute()
    print(f"Found {len(response.data)} existing API keys")
    
    for key in response.data:
        print(f"  - Provider: {key['provider']}, Feature: {key['feature']}, Status: {key['status']}, Priority: {key['priority']}")
    
    # Check if we have HuggingFace keys for clinical and osce
    clinical_hf = [k for k in response.data if k['provider'] == 'huggingface' and k['feature'] == 'clinical']
    osce_hf = [k for k in response.data if k['provider'] == 'huggingface' and k['feature'] == 'osce']
    
    print(f"\nHuggingFace keys for clinical: {len(clinical_hf)}")
    print(f"HuggingFace keys for osce: {len(osce_hf)}")
    
    if not huggingface_key:
        print("\n❌ HUGGINGFACE_API_KEY not found in environment variables")
        return
    
    # Encrypt the key
    encrypted_key = encryption_service.encrypt_key(huggingface_key)
    
    # Add or update keys
    features_to_add = []
    
    if not clinical_hf:
        features_to_add.append('clinical')
    else:
        # Update existing
        for key in clinical_hf:
            if key['status'] != 'active':
                print(f"\nActivating existing clinical key (ID: {key['id']})")
                supabase.table("api_keys").update({
                    "status": "active",
                    "key_value": encrypted_key
                }).eq("id", key['id']).execute()
    
    if not osce_hf:
        features_to_add.append('osce')
    else:
        # Update existing
        for key in osce_hf:
            if key['status'] != 'active':
                print(f"\nActivating existing osce key (ID: {key['id']})")
                supabase.table("api_keys").update({
                    "status": "active",
                    "key_value": encrypted_key
                }).eq("id", key['id']).execute()
    
    # Add new keys if needed
    for feature in features_to_add:
        print(f"\nAdding new HuggingFace key for feature: {feature}")
        
        key_data = {
            "provider": "huggingface",
            "feature": feature,
            "key_value": encrypted_key,
            "status": "active",
            "priority": 1
        }
        
        result = supabase.table("api_keys").insert(key_data).execute()
        print(f"✓ Added key for {feature}: {result.data[0]['id']}")
    
    # Verify
    print("\n" + "="*80)
    print("VERIFICATION")
    print("="*80)
    
    response = supabase.table("api_keys").select("*").eq("status", "active").execute()
    print(f"\nActive API keys: {len(response.data)}")
    
    for key in response.data:
        print(f"  - Provider: {key['provider']}, Feature: {key['feature']}, Priority: {key['priority']}")
    
    print("\n✓ API keys configuration complete!")

if __name__ == "__main__":
    asyncio.run(fix_api_keys())
