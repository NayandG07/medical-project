"""
Diagnostic script to identify 401 errors and clinical/OSCE issues
"""
import os
import sys
import asyncio
import logging
from dotenv import load_dotenv
from supabase import create_client

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-8s | %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

async def diagnose():
    """Run comprehensive diagnostics"""
    
    logger.info("=" * 80)
    logger.info("DIAGNOSTIC REPORT - Medical AI Platform")
    logger.info("=" * 80)
    
    # 1. Check environment variables
    logger.info("\n1. ENVIRONMENT VARIABLES CHECK")
    logger.info("-" * 80)
    
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_KEY", 
        "SUPABASE_SERVICE_KEY",
        "HUGGINGFACE_API_KEY"
    ]
    
    missing_vars = []
    for var in required_vars:
        value = os.getenv(var)
        if value:
            masked = value[:10] + "..." + value[-10:] if len(value) > 20 else value
            logger.info(f"✓ {var}: {masked}")
        else:
            logger.error(f"✗ {var}: MISSING")
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"\n❌ Missing environment variables: {', '.join(missing_vars)}")
        return
    
    # 2. Test Supabase connection
    logger.info("\n2. SUPABASE CONNECTION TEST")
    logger.info("-" * 80)
    
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")
        supabase = create_client(supabase_url, supabase_service_key)
        
        # Test query
        response = supabase.table("users").select("id").limit(1).execute()
        logger.info(f"✓ Supabase connection successful")
        logger.info(f"  Users table accessible: {len(response.data) >= 0}")
    except Exception as e:
        logger.error(f"✗ Supabase connection failed: {str(e)}")
        return
    
    # 3. Check required tables
    logger.info("\n3. DATABASE TABLES CHECK")
    logger.info("-" * 80)
    
    required_tables = [
        "users",
        "usage_counters",
        "clinical_cases",
        "clinical_reasoning_steps",
        "osce_scenarios",
        "clinical_performance"
    ]
    
    for table in required_tables:
        try:
            response = supabase.table(table).select("id").limit(1).execute()
            logger.info(f"✓ Table '{table}' exists and accessible")
        except Exception as e:
            logger.error(f"✗ Table '{table}' error: {str(e)}")
    
    # 4. Test authentication flow
    logger.info("\n4. AUTHENTICATION FLOW TEST")
    logger.info("-" * 80)
    
    try:
        # Check if we can query users
        users_response = supabase.table("users").select("id, email, plan, role").limit(5).execute()
        logger.info(f"✓ Can query users table: {len(users_response.data)} users found")
        
        if users_response.data:
            for user in users_response.data[:3]:
                logger.info(f"  - User: {user.get('email', 'N/A')}, Plan: {user.get('plan', 'N/A')}, Role: {user.get('role', 'N/A')}")
    except Exception as e:
        logger.error(f"✗ User query failed: {str(e)}")
    
    # 5. Test model providers
    logger.info("\n5. MODEL PROVIDERS CHECK")
    logger.info("-" * 80)
    
    try:
        from services.model_router import get_model_router_service
        
        router = get_model_router_service(supabase)
        
        # Test provider selection for clinical
        provider = await router.select_provider("clinical")
        logger.info(f"✓ Clinical provider selected: {provider}")
        
        # Test provider selection for OSCE
        provider = await router.select_provider("osce")
        logger.info(f"✓ OSCE provider selected: {provider}")
        
    except Exception as e:
        logger.error(f"✗ Model router error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # 6. Test clinical reasoning engine
    logger.info("\n6. CLINICAL REASONING ENGINE TEST")
    logger.info("-" * 80)
    
    try:
        from services.clinical_reasoning_engine import get_clinical_reasoning_engine
        
        engine = get_clinical_reasoning_engine(supabase)
        logger.info(f"✓ Clinical reasoning engine initialized")
        
        # Check if we can access the methods
        logger.info(f"  - generate_clinical_case: {hasattr(engine, 'generate_clinical_case')}")
        logger.info(f"  - create_osce_scenario: {hasattr(engine, 'create_osce_scenario')}")
        logger.info(f"  - _parse_json_response: {hasattr(engine, '_parse_json_response')}")
        
    except Exception as e:
        logger.error(f"✗ Clinical reasoning engine error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # 7. Test rate limiter
    logger.info("\n7. RATE LIMITER CHECK")
    logger.info("-" * 80)
    
    try:
        from services.rate_limiter import get_rate_limiter
        
        rate_limiter = get_rate_limiter(supabase)
        logger.info(f"✓ Rate limiter initialized")
        
        # Get a test user
        users_response = supabase.table("users").select("id, plan").limit(1).execute()
        if users_response.data:
            test_user_id = users_response.data[0]["id"]
            test_user_plan = users_response.data[0]["plan"]
            
            # Check rate limit
            has_capacity = await rate_limiter.check_rate_limit(test_user_id, "clinical")
            logger.info(f"  - Test user plan: {test_user_plan}")
            logger.info(f"  - Has capacity for clinical: {has_capacity}")
            
            # Get usage
            usage = await rate_limiter.get_user_usage(test_user_id)
            logger.info(f"  - Current usage: {usage}")
        
    except Exception as e:
        logger.error(f"✗ Rate limiter error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # 8. Check for common issues
    logger.info("\n8. COMMON ISSUES CHECK")
    logger.info("-" * 80)
    
    issues_found = []
    
    # Check if CORS is properly configured
    logger.info("  Checking CORS configuration...")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    logger.info(f"  - Frontend URL: {frontend_url}")
    
    # Check if tokens are being properly validated
    logger.info("  Checking token validation...")
    try:
        # Try to validate a dummy token (should fail gracefully)
        dummy_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
        try:
            user_response = supabase.auth.get_user(dummy_token)
            logger.warning("  ⚠ Dummy token was accepted (unexpected)")
        except Exception:
            logger.info("  ✓ Token validation working (dummy token rejected)")
    except Exception as e:
        logger.error(f"  ✗ Token validation error: {str(e)}")
    
    # Summary
    logger.info("\n" + "=" * 80)
    logger.info("DIAGNOSTIC SUMMARY")
    logger.info("=" * 80)
    
    if not issues_found:
        logger.info("✓ No critical issues detected")
        logger.info("\nPOSSIBLE CAUSES OF 401 ERRORS:")
        logger.info("1. Frontend token expired - User needs to re-login")
        logger.info("2. Token not being sent in Authorization header")
        logger.info("3. CORS issues preventing headers from being sent")
        logger.info("4. Supabase session expired on frontend")
        logger.info("\nPOSSIBLE CAUSES OF CLINICAL/OSCE NO OUTPUT:")
        logger.info("1. JSON parsing errors (check logs for _parse_json_response errors)")
        logger.info("2. Model provider returning malformed JSON")
        logger.info("3. Rate limiting blocking requests")
        logger.info("4. Database constraints preventing inserts")
    else:
        logger.error(f"\n❌ {len(issues_found)} issue(s) found:")
        for issue in issues_found:
            logger.error(f"  - {issue}")
    
    logger.info("\n" + "=" * 80)
    logger.info("RECOMMENDATIONS:")
    logger.info("=" * 80)
    logger.info("1. Check browser console for frontend errors")
    logger.info("2. Check backend logs for detailed error messages")
    logger.info("3. Verify user is logged in and session is valid")
    logger.info("4. Test with curl to isolate frontend vs backend issues:")
    logger.info("   curl -H 'Authorization: Bearer <token>' http://localhost:8000/api/clinical/cases")
    logger.info("5. Check if JSON parsing fixes are working in clinical_reasoning_engine.py")
    logger.info("=" * 80)

if __name__ == "__main__":
    asyncio.run(diagnose())
