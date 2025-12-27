"""
Property-based tests for authentication service
Tests universal properties that should hold for all valid inputs
Requirements: 1.2, 2.2, 2.4, 27.3
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import MagicMock, AsyncMock, patch
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from services.auth import AuthService


# Custom strategies for generating valid test data
@st.composite
def valid_email(draw):
    """Generate valid email addresses"""
    username = draw(st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))))
    domain = draw(st.text(min_size=1, max_size=15, alphabet=st.characters(whitelist_categories=('Lu', 'Ll'))))
    tld = draw(st.sampled_from(['com', 'org', 'net', 'edu']))
    return f"{username}@{domain}.{tld}".lower()


@st.composite
def valid_password(draw):
    """Generate valid passwords (min 8 characters)"""
    return draw(st.text(min_size=8, max_size=50))


@st.composite
def valid_name(draw):
    """Generate valid names"""
    return draw(st.text(min_size=1, max_size=100, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Zs'))))


@st.composite
def valid_user_id(draw):
    """Generate valid UUID-like user IDs"""
    return draw(st.uuids()).hex


@st.composite
def valid_admin_role(draw):
    """Generate valid admin roles"""
    return draw(st.sampled_from(['super_admin', 'admin', 'ops', 'support', 'viewer']))


# Feature: medical-ai-platform, Property 1: User registration assigns default plan
@given(
    email=valid_email(),
    password=valid_password(),
    name=valid_name()
)
@settings(max_examples=100)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_user_registration_default_plan(email, password, name):
    """
    Property 1: For any new user registration, 
    the user should be assigned the "free" plan by default.
    
    Validates: Requirements 1.2
    """
    # Create mock Supabase client
    mock_supabase = MagicMock()
    
    # Mock auth.sign_up response
    mock_user = MagicMock()
    mock_user.id = "test-user-id-123"
    mock_user.email = email
    
    mock_auth_response = MagicMock()
    mock_auth_response.user = mock_user
    mock_auth_response.session = MagicMock()
    
    mock_supabase.auth.sign_up.return_value = mock_auth_response
    
    # Mock table insert
    mock_table = MagicMock()
    mock_execute = MagicMock()
    mock_execute.execute.return_value = MagicMock()
    mock_table.insert.return_value = mock_execute
    mock_supabase.table.return_value = mock_table
    
    # Create auth service with mock client
    auth_service = AuthService(supabase_client=mock_supabase)
    
    # Register user
    result = await auth_service.register_user(email, password, name)
    
    # Property: User should be assigned "free" plan by default
    assert result["plan"] == "free", f"Expected plan to be 'free', got '{result['plan']}'"
    
    # Verify the insert was called with correct data
    mock_table.insert.assert_called_once()
    insert_data = mock_table.insert.call_args[0][0]
    assert insert_data["plan"] == "free", "User data should have 'free' plan"
    assert insert_data["email"] == email
    assert insert_data["name"] == name


# Feature: medical-ai-platform, Property 2: Admin access requires allowlist and role
@given(
    user_id=valid_user_id(),
    email=valid_email(),
    role=valid_admin_role(),
    in_allowlist=st.booleans(),
    has_user_role=st.booleans()
)
@settings(max_examples=100)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_admin_access_requires_allowlist_and_role(user_id, email, role, in_allowlist, has_user_role):
    """
    Property 2: For any email and role combination, admin access should be granted 
    if and only if the email is in the admin_allowlist AND the role permits access.
    
    Validates: Requirements 2.2
    """
    # Create mock Supabase client
    mock_supabase = MagicMock()
    
    # Mock user table response
    user_data = {
        "email": email,
        "role": role if has_user_role else None
    }
    mock_user_response = MagicMock()
    mock_user_response.data = [user_data]
    
    # Mock allowlist table response
    if in_allowlist:
        allowlist_data = [{"role": role}]
    else:
        allowlist_data = []
    
    mock_allowlist_response = MagicMock()
    mock_allowlist_response.data = allowlist_data
    
    # Set up mock table calls
    def mock_table_select(table_name):
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        
        if table_name == "users":
            mock_eq.execute.return_value = mock_user_response
        elif table_name == "admin_allowlist":
            mock_eq.execute.return_value = mock_allowlist_response
        
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        return mock_table
    
    mock_supabase.table.side_effect = mock_table_select
    
    # Create auth service with mock client
    auth_service = AuthService(supabase_client=mock_supabase)
    
    # Verify admin status
    result = await auth_service.verify_admin(user_id)
    
    # Property: Admin access granted if and only if in allowlist AND has role
    expected_admin = in_allowlist and has_user_role
    
    if expected_admin:
        assert result is not None, f"Expected admin access for user in allowlist with role, got None"
        assert result == role, f"Expected role '{role}', got '{result}'"
    else:
        assert result is None, f"Expected no admin access for user not in allowlist or without role, got '{result}'"


# Feature: medical-ai-platform, Property 3: Emergency admin access via environment variable
@given(
    user_id=valid_user_id(),
    email=valid_email(),
    is_super_admin_email=st.booleans()
)
@settings(max_examples=100)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_emergency_admin_access_via_env_var(user_id, email, is_super_admin_email):
    """
    Property 3: For any email matching SUPER_ADMIN_EMAIL environment variable, 
    super_admin access should be granted regardless of database state.
    
    Validates: Requirements 2.4
    """
    # Set up environment variable
    super_admin_email = email if is_super_admin_email else "different@example.com"
    original_env = os.environ.get("SUPER_ADMIN_EMAIL")
    os.environ["SUPER_ADMIN_EMAIL"] = super_admin_email
    
    try:
        # Create mock Supabase client
        mock_supabase = MagicMock()
        
        # Mock user table response
        user_data = {
            "email": email,
            "role": None  # No role in database
        }
        mock_user_response = MagicMock()
        mock_user_response.data = [user_data]
        
        # Mock allowlist table response - empty (not in allowlist)
        mock_allowlist_response = MagicMock()
        mock_allowlist_response.data = []
        
        # Set up mock table calls
        def mock_table_select(table_name):
            mock_table = MagicMock()
            mock_select = MagicMock()
            mock_eq = MagicMock()
            
            if table_name == "users":
                mock_eq.execute.return_value = mock_user_response
            elif table_name == "admin_allowlist":
                mock_eq.execute.return_value = mock_allowlist_response
            
            mock_select.eq.return_value = mock_eq
            mock_table.select.return_value = mock_select
            return mock_table
        
        mock_supabase.table.side_effect = mock_table_select
        
        # Create auth service with mock client
        auth_service = AuthService(supabase_client=mock_supabase)
        
        # Verify admin status
        result = await auth_service.verify_admin(user_id)
        
        # Property: If email matches SUPER_ADMIN_EMAIL, should get super_admin access
        # regardless of database state (not in allowlist, no role)
        if is_super_admin_email:
            assert result == "super_admin", f"Expected 'super_admin' for emergency admin email, got '{result}'"
        else:
            assert result is None, f"Expected None for non-emergency admin email, got '{result}'"
    finally:
        # Restore original environment variable
        if original_env is not None:
            os.environ["SUPER_ADMIN_EMAIL"] = original_env
        elif "SUPER_ADMIN_EMAIL" in os.environ:
            del os.environ["SUPER_ADMIN_EMAIL"]



# Custom strategy for generating API keys
@st.composite
def valid_api_key(draw):
    """Generate valid API keys (various formats)"""
    provider = draw(st.sampled_from(['gemini', 'openai', 'anthropic', 'generic']))
    
    if provider == 'gemini':
        # Gemini keys typically start with "AI"
        key = "AI" + draw(st.text(min_size=20, max_size=40, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))))
    elif provider == 'openai':
        # OpenAI keys typically start with "sk-"
        key = "sk-" + draw(st.text(min_size=40, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))))
    elif provider == 'anthropic':
        # Anthropic keys typically start with "sk-ant-"
        key = "sk-ant-" + draw(st.text(min_size=40, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'))))
    else:
        # Generic API key
        key = draw(st.text(min_size=20, max_size=60, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Pd'))))
    
    return key


@st.composite
def invalid_api_key(draw):
    """Generate invalid API keys (too short, empty, etc.)"""
    key_type = draw(st.sampled_from(['empty', 'too_short', 'whitespace']))
    
    if key_type == 'empty':
        return ""
    elif key_type == 'too_short':
        return draw(st.text(min_size=0, max_size=9))
    else:  # whitespace
        return "   "


# Feature: medical-ai-platform, Property 55: User key validation before acceptance
@given(
    user_id=valid_user_id(),
    api_key=st.one_of(valid_api_key(), invalid_api_key()),
    should_be_valid=st.booleans()
)
@settings(max_examples=100)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_user_key_validation_before_acceptance(user_id, api_key, should_be_valid):
    """
    Property 55: For any user-supplied API key, the system should validate it 
    with a test call before storing it.
    
    This test verifies that:
    1. Valid keys (length >= 10, non-empty) are accepted and encrypted
    2. Invalid keys (empty, too short, whitespace) are rejected
    3. Validation happens before storage
    
    Validates: Requirements 27.3
    """
    # Create mock Supabase client
    mock_supabase = MagicMock()
    
    # Mock table update
    mock_table = MagicMock()
    mock_update = MagicMock()
    mock_eq = MagicMock()
    mock_eq.execute.return_value = MagicMock()
    mock_update.eq.return_value = mock_eq
    mock_table.update.return_value = mock_update
    mock_supabase.table.return_value = mock_table
    
    # Create auth service with mock client
    auth_service = AuthService(supabase_client=mock_supabase)
    
    # Determine if key should be valid based on actual validation rules
    is_actually_valid = api_key and len(api_key.strip()) > 0 and len(api_key) >= 10
    
    # Mock encryption service
    with patch('services.auth.encrypt_key') as mock_encrypt:
        mock_encrypt.return_value = "encrypted_key_data"
        
        # Try to set the user API key
        if is_actually_valid:
            # Valid key should be accepted
            result = await auth_service.set_user_api_key(user_id, api_key)
            
            # Property: Valid keys should be accepted
            assert result["success"] is True, f"Expected success for valid key, got {result}"
            assert "successfully" in result["message"].lower(), f"Expected success message, got {result['message']}"
            
            # Property: Encryption should be called before storage
            mock_encrypt.assert_called_once_with(api_key)
            
            # Property: Database update should be called with encrypted key
            mock_table.update.assert_called_once()
            update_data = mock_table.update.call_args[0][0]
            assert update_data["personal_api_key"] == "encrypted_key_data", "Should store encrypted key"
        else:
            # Invalid key should be rejected
            with pytest.raises(Exception) as exc_info:
                await auth_service.set_user_api_key(user_id, api_key)
            
            # Property: Invalid keys should be rejected with clear error
            error_message = str(exc_info.value).lower()
            assert "invalid" in error_message or "empty" in error_message or "short" in error_message, \
                f"Expected validation error message, got: {exc_info.value}"
            
            # Property: Encryption should NOT be called for invalid keys
            mock_encrypt.assert_not_called()
            
            # Property: Database should NOT be updated for invalid keys
            mock_table.update.assert_not_called()
