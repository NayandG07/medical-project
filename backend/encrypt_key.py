"""
Script to encrypt an API key for database storage
Run this to get an encrypted version of your API key
"""
import os
import sys
from dotenv import load_dotenv

# Add the backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

from services.encryption import get_encryption_service

def main():
    print("=" * 60)
    print("API Key Encryption Tool")
    print("=" * 60)
    print()
    
    # Get the API key from user
    plaintext_key = input("Enter your OpenRouter API key: ").strip()
    
    if not plaintext_key:
        print("Error: No key provided!")
        return
    
    print("\nEncrypting key...")
    
    try:
        # Get encryption service
        encryption_service = get_encryption_service()
        
        # Encrypt the key
        encrypted_key = encryption_service.encrypt_key(plaintext_key)
        
        print("\n" + "=" * 60)
        print("SUCCESS! Key encrypted successfully")
        print("=" * 60)
        print()
        print("Encrypted key:")
        print("-" * 60)
        print(encrypted_key)
        print("-" * 60)
        print()
        print("Now run this SQL in your Supabase SQL Editor:")
        print("=" * 60)
        print(f"""
UPDATE api_keys 
SET key_value = '{encrypted_key}',
    provider = 'openrouter',
    updated_at = NOW();
""")
        print("=" * 60)
        print()
        print("Or to update specific features only:")
        print("=" * 60)
        print(f"""
UPDATE api_keys 
SET key_value = '{encrypted_key}',
    provider = 'openrouter',
    updated_at = NOW()
WHERE feature IN ('chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'clinical', 'osce');
""")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nError: {str(e)}")
        print("\nMake sure:")
        print("1. You have ENCRYPTION_KEY set in your .env file")
        print("2. The encryption service is properly configured")
        return

if __name__ == "__main__":
    main()
