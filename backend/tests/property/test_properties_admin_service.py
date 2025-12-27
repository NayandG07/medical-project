"""
Property-based tests for admin service

Requirements: 13.3, 13.4
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import Mock, AsyncMock, patch
from services.admin import get_admin_service


@given(
    admin_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    user_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    old_plan=st.sampled_from(['free', 'student', 'pro']),
    new_plan=st.sampled_from(['free', 'student', 'pro', 'admin'])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.asyncio
async def test_property_admins_can_modify_user_plans(admin_id, user_id, old_plan, new_plan):
    """
    Property 42: Admins can modify user plans
    
    Tests that admins can successfully change user plans and that
    the change is logged in the audit trail.
    
    Requirements: 13.3
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock getting current plan
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
        data=[{"plan": old_plan}]
    )
    
    # Mock updating plan
    mock_updated_user = {
        "id": user_id,
        "plan": new_plan,
        "email": "user@example.com"
    }
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock(
        data=[mock_updated_user]
    )
    
    # Mock encryption and audit logging
    with patch('services.admin.get_encryption_service') as mock_enc_getter, \
         patch('services.admin.get_audit_service') as mock_audit_getter:
        
        mock_encryption = Mock()
        mock_enc_getter.return_value = mock_encryption
        
        mock_audit = AsyncMock()
        mock_audit.log_admin_action = AsyncMock()
        mock_audit_getter.return_value = mock_audit
        
        admin_service = get_admin_service(mock_supabase)
        
        # Update user plan
        result = await admin_service.update_user_plan(
            admin_id=admin_id,
            user_id=user_id,
            new_plan=new_plan
        )
        
        # Property: Plan should be updated successfully
        assert result is not None, "Plan update should return result"
        assert result["plan"] == new_plan, "Plan should be updated to new plan"
        
        # Property: Action should be logged
        mock_audit.log_admin_action.assert_called_once()
        call_args = mock_audit.log_admin_action.call_args
        assert call_args.kwargs["admin_id"] == admin_id
        assert call_args.kwargs["action_type"] == "update_plan"
        assert call_args.kwargs["target_type"] == "user"
        assert call_args.kwargs["target_id"] == user_id
        assert call_args.kwargs["details"]["old_plan"] == old_plan
        assert call_args.kwargs["details"]["new_plan"] == new_plan


@given(
    admin_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    user_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    tokens_used=st.integers(min_value=0, max_value=100000),
    requests_count=st.integers(min_value=0, max_value=1000)
)
@settings(max_examples=100, deadline=None)
@pytest.mark.asyncio
async def test_property_admins_can_reset_usage_counters(admin_id, user_id, tokens_used, requests_count):
    """
    Property 43: Admins can reset usage counters
    
    Tests that admins can reset user usage counters to zero and that
    the reset is logged in the audit trail.
    
    Requirements: 13.4
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock getting current usage
    old_usage = {
        "user_id": user_id,
        "date": "2024-01-01",
        "tokens_used": tokens_used,
        "requests_count": requests_count,
        "pdf_uploads": 5,
        "mcqs_generated": 10,
        "images_used": 3,
        "flashcards_generated": 8
    }
    
    # Mock reset usage
    reset_usage = {
        "user_id": user_id,
        "date": "2024-01-01",
        "tokens_used": 0,
        "requests_count": 0,
        "pdf_uploads": 0,
        "mcqs_generated": 0,
        "images_used": 0,
        "flashcards_generated": 0
    }
    
    # Set up mock to return different responses for different calls
    def mock_table_call(table_name):
        mock_table = Mock()
        if table_name == "usage_counters":
            # First call: select current usage
            mock_select = Mock()
            mock_select.select.return_value.eq.return_value.eq.return_value.execute.return_value = Mock(
                data=[old_usage]
            )
            # Second call: update usage
            mock_select.update.return_value.eq.return_value.eq.return_value.execute.return_value = Mock(
                data=[reset_usage]
            )
            return mock_select
        return mock_table
    
    mock_supabase.table.side_effect = mock_table_call
    
    # Mock encryption and audit logging
    with patch('services.admin.get_encryption_service') as mock_enc_getter, \
         patch('services.admin.get_audit_service') as mock_audit_getter:
        
        mock_encryption = Mock()
        mock_enc_getter.return_value = mock_encryption
        
        mock_audit = AsyncMock()
        mock_audit.log_admin_action = AsyncMock()
        mock_audit_getter.return_value = mock_audit
        
        admin_service = get_admin_service(mock_supabase)
        
        # Reset user usage
        result = await admin_service.reset_user_usage(
            admin_id=admin_id,
            user_id=user_id
        )
        
        # Property: Usage should be reset successfully
        assert result is not None, "Usage reset should return result"
        assert result["reset"] is True, "Reset flag should be True"
        assert result["user_id"] == user_id, "User ID should match"
        
        # Property: Action should be logged
        mock_audit.log_admin_action.assert_called_once()
        call_args = mock_audit.log_admin_action.call_args
        assert call_args.kwargs["admin_id"] == admin_id
        assert call_args.kwargs["action_type"] == "reset_usage"
        assert call_args.kwargs["target_type"] == "user"
        assert call_args.kwargs["target_id"] == user_id


@given(
    admin_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    user_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    disable_action=st.booleans()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.asyncio
async def test_property_admins_can_disable_enable_users(admin_id, user_id, disable_action):
    """
    Property: Admins can disable and enable users
    
    Tests that admins can disable or enable user accounts and that
    the action is logged in the audit trail.
    
    Requirements: 13.5
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock getting current disabled status
    old_disabled = not disable_action  # Opposite of the action we're taking
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
        data=[{"disabled": old_disabled}]
    )
    
    # Mock updating disabled status
    mock_updated_user = {
        "id": user_id,
        "disabled": disable_action,
        "email": "user@example.com"
    }
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock(
        data=[mock_updated_user]
    )
    
    # Mock encryption and audit logging
    with patch('services.admin.get_encryption_service') as mock_enc_getter, \
         patch('services.admin.get_audit_service') as mock_audit_getter:
        
        mock_encryption = Mock()
        mock_enc_getter.return_value = mock_encryption
        
        mock_audit = AsyncMock()
        mock_audit.log_admin_action = AsyncMock()
        mock_audit_getter.return_value = mock_audit
        
        admin_service = get_admin_service(mock_supabase)
        
        # Disable or enable user
        result = await admin_service.disable_user(
            admin_id=admin_id,
            user_id=user_id,
            disabled=disable_action
        )
        
        # Property: Disabled status should be updated successfully
        assert result is not None, "Disable/enable should return result"
        assert result["disabled"] == disable_action, "Disabled status should match requested action"
        
        # Property: Action should be logged
        mock_audit.log_admin_action.assert_called_once()
        call_args = mock_audit.log_admin_action.call_args
        assert call_args.kwargs["admin_id"] == admin_id
        expected_action = "disable_user" if disable_action else "enable_user"
        assert call_args.kwargs["action_type"] == expected_action
        assert call_args.kwargs["target_type"] == "user"
        assert call_args.kwargs["target_id"] == user_id


@given(
    plan_filter=st.sampled_from(['free', 'student', 'pro', 'admin', None])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.asyncio
async def test_property_list_users_with_filters(plan_filter):
    """
    Property: Admins can list users with optional filters
    
    Tests that admins can retrieve user lists with optional filtering.
    
    Requirements: 13.1
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock user list
    mock_users = [
        {"id": "user-1", "email": "user1@example.com", "plan": plan_filter or "free"},
        {"id": "user-2", "email": "user2@example.com", "plan": plan_filter or "free"}
    ]
    
    # Set up mock chain for query building
    mock_query = Mock()
    mock_query.eq.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.execute.return_value = Mock(data=mock_users)
    
    mock_supabase.table.return_value.select.return_value = mock_query
    
    # Mock encryption service
    with patch('services.admin.get_encryption_service') as mock_enc_getter:
        mock_encryption = Mock()
        mock_enc_getter.return_value = mock_encryption
        
        admin_service = get_admin_service(mock_supabase)
        
        # List users with optional filter
        result = await admin_service.list_users(plan=plan_filter)
        
        # Property: Should return list of users
        assert result is not None, "Should return user list"
        assert isinstance(result, list), "Result should be a list"
        if plan_filter:
            assert all(user["plan"] == plan_filter for user in result), "All users should match filter"


# API Key Management Property Tests

@given(
    admin_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    provider=st.sampled_from(['gemini', 'openai', 'ollama']),
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'image']),
    key=st.text(min_size=20, max_size=100, alphabet=st.characters(blacklist_characters='\x00')),
    priority=st.integers(min_value=0, max_value=10)
)
@settings(max_examples=100, deadline=None)
@pytest.mark.asyncio
async def test_property_admins_can_add_api_keys(admin_id, provider, feature, key, priority):
    """
    Property 45: Admins can add API keys
    
    Tests that admins can successfully add API keys with encryption
    and that the addition is logged in the audit trail.
    
    Requirements: 14.2
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock API key creation
    mock_created_key = {
        "id": "key-123",
        "provider": provider,
        "feature": feature,
        "key_value": "encrypted_key_value",
        "priority": priority,
        "status": "active",
        "failure_count": 0
    }
    
    mock_supabase.table.return_value.insert.return_value.execute.return_value = Mock(
        data=[mock_created_key]
    )
    
    # Mock encryption service
    with patch('services.admin.get_encryption_service') as mock_enc_getter, \
         patch('services.admin.get_audit_service') as mock_audit_getter:
        
        mock_encryption = Mock()
        mock_encryption.encrypt_key.return_value = "encrypted_key_value"
        mock_enc_getter.return_value = mock_encryption
        
        mock_audit = AsyncMock()
        mock_audit.log_admin_action = AsyncMock()
        mock_audit_getter.return_value = mock_audit
        
        admin_service = get_admin_service(mock_supabase)
        
        # Add API key
        result = await admin_service.add_api_key(
            admin_id=admin_id,
            provider=provider,
            feature=feature,
            key=key,
            priority=priority
        )
        
        # Property: Key should be added successfully
        assert result is not None, "API key addition should return result"
        assert result["provider"] == provider, "Provider should match"
        assert result["feature"] == feature, "Feature should match"
        assert result["priority"] == priority, "Priority should match"
        assert result["status"] == "active", "Status should be active"
        
        # Property: Key should be encrypted before storage
        mock_encryption.encrypt_key.assert_called_once_with(key)
        
        # Property: Action should be logged
        mock_audit.log_admin_action.assert_called_once()
        call_args = mock_audit.log_admin_action.call_args
        assert call_args.kwargs["admin_id"] == admin_id
        assert call_args.kwargs["action_type"] == "add_api_key"
        assert call_args.kwargs["target_type"] == "api_key"
        assert call_args.kwargs["details"]["provider"] == provider
        assert call_args.kwargs["details"]["feature"] == feature


@given(
    key=st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_characters='\x00')),
    provider=st.sampled_from(['gemini', 'openai', 'ollama', 'unknown'])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.asyncio
async def test_property_api_keys_are_validated_before_storage(key, provider):
    """
    Property 46: API keys are validated before storage
    
    Tests that API keys are validated before being stored in the database.
    
    Requirements: 14.7
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock encryption service to avoid needing ENCRYPTION_KEY
    with patch('services.admin.get_encryption_service') as mock_enc_getter:
        mock_encryption = Mock()
        mock_enc_getter.return_value = mock_encryption
        
        admin_service = get_admin_service(mock_supabase)
        
        # Test API key validation
        result = await admin_service.test_api_key(key=key, provider=provider)
        
        # Property: Validation should return a result
        assert result is not None, "Validation should return result"
        assert "valid" in result, "Result should contain 'valid' field"
        assert "message" in result, "Result should contain 'message' field"
        
        # Property: Short keys should be rejected
        if len(key) < 10:
            assert result["valid"] is False, "Short keys should be invalid"
        
        # Property: Provider-specific validation should be applied
        if provider == "gemini" and len(key) >= 10:
            if not key.startswith("AI"):
                assert result["valid"] is False, "Gemini keys should start with 'AI'"
        
        if provider == "openai" and len(key) >= 10:
            if not key.startswith("sk-"):
                assert result["valid"] is False, "OpenAI keys should start with 'sk-'"


@given(
    admin_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    key_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    old_status=st.sampled_from(['active', 'degraded', 'disabled']),
    new_status=st.sampled_from(['active', 'degraded', 'disabled'])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.asyncio
async def test_property_admins_can_toggle_key_status(admin_id, key_id, old_status, new_status):
    """
    Property 47: Admins can toggle key status
    
    Tests that admins can successfully change API key status and that
    the change is logged in the audit trail.
    
    Requirements: 14.4
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock getting current status
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = Mock(
        data=[{
            "status": old_status,
            "provider": "gemini",
            "feature": "chat"
        }]
    )
    
    # Mock updating status
    mock_updated_key = {
        "id": key_id,
        "status": new_status,
        "provider": "gemini",
        "feature": "chat"
    }
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = Mock(
        data=[mock_updated_key]
    )
    
    # Mock encryption and audit logging
    with patch('services.admin.get_encryption_service') as mock_enc_getter, \
         patch('services.admin.get_audit_service') as mock_audit_getter:
        
        mock_encryption = Mock()
        mock_enc_getter.return_value = mock_encryption
        
        mock_audit = AsyncMock()
        mock_audit.log_admin_action = AsyncMock()
        mock_audit_getter.return_value = mock_audit
        
        admin_service = get_admin_service(mock_supabase)
        
        # Update key status
        result = await admin_service.update_key_status(
            admin_id=admin_id,
            key_id=key_id,
            status=new_status
        )
        
        # Property: Status should be updated successfully
        assert result is not None, "Status update should return result"
        assert result["status"] == new_status, "Status should be updated to new status"
        
        # Property: Action should be logged
        mock_audit.log_admin_action.assert_called_once()
        call_args = mock_audit.log_admin_action.call_args
        assert call_args.kwargs["admin_id"] == admin_id
        assert call_args.kwargs["action_type"] == "update_key_status"
        assert call_args.kwargs["target_type"] == "api_key"
        assert call_args.kwargs["target_id"] == key_id
        assert call_args.kwargs["details"]["old_status"] == old_status
        assert call_args.kwargs["details"]["new_status"] == new_status



# Feature: medical-ai-platform, Property 48: Admins can toggle features globally
@given(
    admin_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf']),
    enabled=st.booleans()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_admins_can_toggle_features_globally(admin_id, feature, enabled):
    """
    Property 48: For any admin user and any feature, the admin should be able to
    toggle the feature on or off globally.
    
    Validates: Requirements 16.2
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock table operations
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_update = Mock()
    mock_insert = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_table.update.return_value = mock_update
    mock_table.insert.return_value = mock_insert
    
    # Mock existing flag check (no existing flag)
    mock_eq.execute.return_value = Mock(data=[])
    mock_insert.execute.return_value = Mock(data=[{"id": "flag-1"}])
    
    # Mock encryption and audit logging
    with patch('services.admin.get_encryption_service') as mock_enc_getter, \
         patch('services.admin.get_audit_service') as mock_audit_getter:
        
        mock_enc_service = Mock()
        mock_enc_getter.return_value = mock_enc_service
        
        mock_audit_service = Mock()
        mock_audit_service.log_admin_action = AsyncMock()
        mock_audit_getter.return_value = mock_audit_service
        
        # Create admin service
        admin_service = get_admin_service(mock_supabase)
        
        # Toggle feature
        result = await admin_service.toggle_feature(
            admin_id=admin_id,
            feature=feature,
            enabled=enabled
        )
        
        # Property: Feature should be toggled successfully
        assert result["feature"] == feature, "Feature name should match"
        assert result["enabled"] == enabled, "Enabled status should match"
        assert "message" in result, "Should include success message"
        
        # Property: Action should be logged in audit trail
        assert mock_audit_service.log_admin_action.called, \
            "Feature toggle should be logged in audit trail"
        
        # Verify audit log was called with correct parameters
        call_args = mock_audit_service.log_admin_action.call_args
        assert call_args[1]["admin_id"] == admin_id, "Audit log should include admin ID"
        assert call_args[1]["action_type"] == "toggle_feature", "Audit log should specify action type"
        assert call_args[1]["target_type"] == "feature", "Audit log should specify target type"
        assert call_args[1]["target_id"] == feature, "Audit log should include feature name"
        assert call_args[1]["details"]["enabled"] == enabled, "Audit log should include enabled status"


@given(
    admin_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf']),
    initial_enabled=st.booleans()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_feature_toggle_updates_existing_flag(admin_id, feature, initial_enabled):
    """
    Property: For any feature that already has a toggle flag,
    toggling it should update the existing flag rather than create a new one.
    
    Validates: Requirements 16.2
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock table operations
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_update = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_table.update.return_value = mock_update
    
    # Mock existing flag (flag already exists)
    mock_eq.execute.return_value = Mock(data=[{"id": "existing-flag-1"}])
    mock_update.eq.return_value.execute.return_value = Mock(data=[{"id": "existing-flag-1"}])
    
    # Mock encryption and audit logging
    with patch('services.admin.get_encryption_service') as mock_enc_getter, \
         patch('services.admin.get_audit_service') as mock_audit_getter:
        
        mock_enc_service = Mock()
        mock_enc_getter.return_value = mock_enc_service
        
        mock_audit_service = Mock()
        mock_audit_service.log_admin_action = AsyncMock()
        mock_audit_getter.return_value = mock_audit_service
        
        # Create admin service
        admin_service = get_admin_service(mock_supabase)
        
        # Toggle feature (should update existing flag)
        new_enabled = not initial_enabled
        result = await admin_service.toggle_feature(
            admin_id=admin_id,
            feature=feature,
            enabled=new_enabled
        )
        
        # Property: Should update existing flag
        assert result["feature"] == feature, "Feature name should match"
        assert result["enabled"] == new_enabled, "Enabled status should be updated"
        
        # Property: Update should be called (not insert)
        assert mock_table.update.called, "Should update existing flag"


@given(
    features=st.lists(
        st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf']),
        min_size=1,
        max_size=8,
        unique=True
    )
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_get_feature_status_returns_all_features(features):
    """
    Property: For any set of features, get_feature_status should return
    the status of all features (including defaults for features not in database).
    
    Validates: Requirements 16.2, 16.4
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock table operations
    mock_table = Mock()
    mock_select = Mock()
    mock_like = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.like.return_value = mock_like
    
    # Mock feature flags in database
    mock_flags = [
        {
            "flag_name": f"feature_{feature}_enabled",
            "flag_value": "True"
        }
        for feature in features
    ]
    
    mock_like.execute.return_value = Mock(data=mock_flags)
    
    # Mock encryption and audit logging
    with patch('services.admin.get_encryption_service') as mock_enc_getter, \
         patch('services.admin.get_audit_service') as mock_audit_getter:
        
        mock_enc_service = Mock()
        mock_enc_getter.return_value = mock_enc_service
        
        mock_audit_service = Mock()
        mock_audit_getter.return_value = mock_audit_service
        
        # Create admin service
        admin_service = get_admin_service(mock_supabase)
        
        # Get feature status
        status = await admin_service.get_feature_status()
        
        # Property: Should return a dict
        assert isinstance(status, dict), "Should return a dictionary"
        
        # Property: All features in database should be present
        for feature in features:
            assert feature in status, f"Feature {feature} should be in status"
            assert status[feature] is True, f"Feature {feature} should be enabled"
        
        # Property: Default features should be present (even if not in database)
        default_features = ["chat", "flashcard", "mcq", "highyield", "explain", "map", "image", "pdf"]
        for feature in default_features:
            assert feature in status, f"Default feature {feature} should be in status"


@given(
    admin_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters='\x00')),
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf'])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_feature_toggle_round_trip(admin_id, feature):
    """
    Property: For any feature, toggling it on then off (or off then on)
    should result in the final state being correct.
    
    Validates: Requirements 16.2
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock table operations
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_insert = Mock()
    mock_update = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_table.insert.return_value = mock_insert
    mock_table.update.return_value = mock_update
    
    # Mock encryption and audit logging
    with patch('services.admin.get_encryption_service') as mock_enc_getter, \
         patch('services.admin.get_audit_service') as mock_audit_getter:
        
        mock_enc_service = Mock()
        mock_enc_getter.return_value = mock_enc_service
        
        mock_audit_service = Mock()
        mock_audit_service.log_admin_action = AsyncMock()
        mock_audit_getter.return_value = mock_audit_service
        
        # Create admin service
        admin_service = get_admin_service(mock_supabase)
        
        # First toggle: enable
        mock_eq.execute.return_value = Mock(data=[])
        mock_insert.execute.return_value = Mock(data=[{"id": "flag-1"}])
        
        result1 = await admin_service.toggle_feature(
            admin_id=admin_id,
            feature=feature,
            enabled=True
        )
        
        # Property: First toggle should enable
        assert result1["enabled"] is True, "First toggle should enable feature"
        
        # Second toggle: disable
        mock_eq.execute.return_value = Mock(data=[{"id": "flag-1"}])
        mock_update.eq.return_value.execute.return_value = Mock(data=[{"id": "flag-1"}])
        
        result2 = await admin_service.toggle_feature(
            admin_id=admin_id,
            feature=feature,
            enabled=False
        )
        
        # Property: Second toggle should disable (round trip complete)
        assert result2["enabled"] is False, "Second toggle should disable feature"
        
        # Property: Both actions should be logged
        assert mock_audit_service.log_admin_action.call_count == 2, \
            "Both toggles should be logged"
