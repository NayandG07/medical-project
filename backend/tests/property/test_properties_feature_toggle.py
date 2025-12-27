"""
Property-based tests for feature toggle middleware

Requirements: 16.3
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import Mock, AsyncMock, patch
from fastapi import Request
from fastapi.exceptions import HTTPException
from middleware.feature_toggle import get_feature_toggle_middleware


# Feature: medical-ai-platform, Property 49: Disabled features reject requests
@given(
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf']),
    is_enabled=st.booleans()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_disabled_features_reject_requests(feature, is_enabled):
    """
    Property 49: Disabled features reject requests
    
    For any feature that is disabled, requests to that feature should be rejected
    with a clear error message (403 Forbidden).
    
    Validates: Requirements 16.3
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock table operations for feature status check
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    
    # Mock feature status
    flag_name = f"feature_{feature}_enabled"
    mock_eq.execute.return_value = Mock(
        data=[{"flag_value": str(is_enabled)}]
    )
    
    # Create middleware
    middleware = get_feature_toggle_middleware(mock_supabase)
    
    # Map feature to route
    feature_routes = {
        'chat': '/api/chat/sessions',
        'flashcard': '/api/commands/flashcard',
        'mcq': '/api/commands/mcq',
        'highyield': '/api/commands/highyield',
        'explain': '/api/commands/explain',
        'map': '/api/commands/map',
        'image': '/api/images/upload',
        'pdf': '/api/documents/upload'
    }
    
    # Create mock request
    mock_request = Mock(spec=Request)
    mock_request.url.path = feature_routes[feature]
    
    if is_enabled:
        # Property: Enabled features should allow requests
        try:
            await middleware.check_feature_enabled(mock_request)
            # Should not raise exception
            assert True, "Enabled feature should allow request"
        except HTTPException:
            pytest.fail("Enabled feature should not raise HTTPException")
    else:
        # Property: Disabled features should reject requests with 403
        with pytest.raises(HTTPException) as exc_info:
            await middleware.check_feature_enabled(mock_request)
        
        # Property: Should return 403 Forbidden
        assert exc_info.value.status_code == 403, \
            "Disabled feature should return 403 Forbidden"
        
        # Property: Error message should be clear and user-friendly
        error_detail = exc_info.value.detail
        assert "error" in error_detail, "Should include error object"
        assert "code" in error_detail["error"], "Should include error code"
        assert error_detail["error"]["code"] == "FEATURE_DISABLED", \
            "Error code should be FEATURE_DISABLED"
        
        # Property: Error message should mention the feature
        assert "message" in error_detail["error"], "Should include error message"
        assert feature in error_detail["error"]["message"], \
            "Error message should mention the disabled feature"
        
        # Property: Error should indicate feature is disabled
        assert "disabled" in error_detail["error"], "Should include disabled flag"
        assert error_detail["error"]["disabled"] is True, \
            "Disabled flag should be True"


@given(
    exempt_route=st.sampled_from([
        '/api/health',
        '/api/auth/login',
        '/api/auth/register',
        '/api/admin/users',
        '/api/admin/api-keys'
    ])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_exempt_routes_always_allowed(exempt_route):
    """
    Property: Exempt routes (health, auth, admin) should always be allowed
    regardless of feature toggle status.
    
    Validates: Requirements 16.3
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Create middleware
    middleware = get_feature_toggle_middleware(mock_supabase)
    
    # Create mock request
    mock_request = Mock(spec=Request)
    mock_request.url.path = exempt_route
    
    # Property: Exempt routes should never raise exception
    try:
        await middleware.check_feature_enabled(mock_request)
        # Should not raise exception
        assert True, "Exempt route should always be allowed"
    except HTTPException:
        pytest.fail(f"Exempt route {exempt_route} should not raise HTTPException")


@given(
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf'])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_feature_without_flag_defaults_to_enabled(feature):
    """
    Property: For any feature that doesn't have a toggle flag in the database,
    the feature should default to enabled (allow requests).
    
    Validates: Requirements 16.3
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock table operations for feature status check
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    
    # Mock no feature flag exists (empty data)
    mock_eq.execute.return_value = Mock(data=[])
    
    # Create middleware
    middleware = get_feature_toggle_middleware(mock_supabase)
    
    # Map feature to route
    feature_routes = {
        'chat': '/api/chat/sessions',
        'flashcard': '/api/commands/flashcard',
        'mcq': '/api/commands/mcq',
        'highyield': '/api/commands/highyield',
        'explain': '/api/commands/explain',
        'map': '/api/commands/map',
        'image': '/api/images/upload',
        'pdf': '/api/documents/upload'
    }
    
    # Create mock request
    mock_request = Mock(spec=Request)
    mock_request.url.path = feature_routes[feature]
    
    # Property: Feature without flag should default to enabled (no exception)
    try:
        await middleware.check_feature_enabled(mock_request)
        # Should not raise exception
        assert True, "Feature without flag should default to enabled"
    except HTTPException:
        pytest.fail("Feature without flag should not raise HTTPException")


@given(
    path=st.text(min_size=1, max_size=100, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd'),
        whitelist_characters='/-_'
    ))
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_unmapped_routes_always_allowed(path):
    """
    Property: For any route that doesn't map to a specific feature,
    the request should be allowed (no feature toggle check).
    
    Validates: Requirements 16.3
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Create middleware
    middleware = get_feature_toggle_middleware(mock_supabase)
    
    # Create mock request with unmapped path
    mock_request = Mock(spec=Request)
    # Ensure path doesn't match any feature route
    if not any(path.startswith(route) for route in [
        '/api/chat', '/api/commands', '/api/documents', '/api/images'
    ]):
        mock_request.url.path = f'/api/{path}'
        
        # Property: Unmapped routes should not raise exception
        try:
            await middleware.check_feature_enabled(mock_request)
            # Should not raise exception
            assert True, "Unmapped route should be allowed"
        except HTTPException:
            pytest.fail(f"Unmapped route {path} should not raise HTTPException")


@given(
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf']),
    initial_enabled=st.booleans()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_feature_toggle_affects_requests_immediately(feature, initial_enabled):
    """
    Property: For any feature, changing its toggle status should immediately
    affect whether requests to that feature are allowed or rejected.
    
    Validates: Requirements 16.3
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock table operations for feature status check
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    
    # Create middleware
    middleware = get_feature_toggle_middleware(mock_supabase)
    
    # Map feature to route
    feature_routes = {
        'chat': '/api/chat/sessions',
        'flashcard': '/api/commands/flashcard',
        'mcq': '/api/commands/mcq',
        'highyield': '/api/commands/highyield',
        'explain': '/api/commands/explain',
        'map': '/api/commands/map',
        'image': '/api/images/upload',
        'pdf': '/api/documents/upload'
    }
    
    # Create mock request
    mock_request = Mock(spec=Request)
    mock_request.url.path = feature_routes[feature]
    
    # First check with initial status
    mock_eq.execute.return_value = Mock(
        data=[{"flag_value": str(initial_enabled)}]
    )
    
    if initial_enabled:
        # Should allow request
        try:
            await middleware.check_feature_enabled(mock_request)
            assert True, "Initially enabled feature should allow request"
        except HTTPException:
            pytest.fail("Initially enabled feature should not raise exception")
    else:
        # Should reject request
        with pytest.raises(HTTPException) as exc_info:
            await middleware.check_feature_enabled(mock_request)
        assert exc_info.value.status_code == 403, \
            "Initially disabled feature should return 403"
    
    # Change status
    new_enabled = not initial_enabled
    mock_eq.execute.return_value = Mock(
        data=[{"flag_value": str(new_enabled)}]
    )
    
    # Property: Status change should immediately affect requests
    if new_enabled:
        # Should now allow request
        try:
            await middleware.check_feature_enabled(mock_request)
            assert True, "Newly enabled feature should allow request"
        except HTTPException:
            pytest.fail("Newly enabled feature should not raise exception")
    else:
        # Should now reject request
        with pytest.raises(HTTPException) as exc_info:
            await middleware.check_feature_enabled(mock_request)
        assert exc_info.value.status_code == 403, \
            "Newly disabled feature should return 403"


@given(
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf'])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_disabled_feature_error_includes_feature_name(feature):
    """
    Property: For any disabled feature, the error message should include
    the specific feature name so users know which feature is disabled.
    
    Validates: Requirements 16.3
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock table operations for feature status check
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    
    # Mock feature as disabled
    mock_eq.execute.return_value = Mock(
        data=[{"flag_value": "False"}]
    )
    
    # Create middleware
    middleware = get_feature_toggle_middleware(mock_supabase)
    
    # Map feature to route
    feature_routes = {
        'chat': '/api/chat/sessions',
        'flashcard': '/api/commands/flashcard',
        'mcq': '/api/commands/mcq',
        'highyield': '/api/commands/highyield',
        'explain': '/api/commands/explain',
        'map': '/api/commands/map',
        'image': '/api/images/upload',
        'pdf': '/api/documents/upload'
    }
    
    # Create mock request
    mock_request = Mock(spec=Request)
    mock_request.url.path = feature_routes[feature]
    
    # Property: Disabled feature should raise exception with feature name
    with pytest.raises(HTTPException) as exc_info:
        await middleware.check_feature_enabled(mock_request)
    
    error_detail = exc_info.value.detail
    
    # Property: Error should include the specific feature name
    assert "feature" in error_detail["error"], \
        "Error should include feature field"
    assert error_detail["error"]["feature"] == feature, \
        f"Error should specify feature name '{feature}'"
    
    # Property: Error message should mention the feature
    assert feature in error_detail["error"]["message"], \
        f"Error message should mention feature '{feature}'"


@given(
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf'])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_get_feature_from_path_correctly_maps_routes(feature):
    """
    Property: For any feature, the middleware should correctly identify
    the feature from the request path.
    
    Validates: Requirements 16.3
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Create middleware
    middleware = get_feature_toggle_middleware(mock_supabase)
    
    # Map feature to route
    feature_routes = {
        'chat': '/api/chat/sessions',
        'flashcard': '/api/commands/flashcard',
        'mcq': '/api/commands/mcq',
        'highyield': '/api/commands/highyield',
        'explain': '/api/commands/explain',
        'map': '/api/commands/map',
        'image': '/api/images/upload',
        'pdf': '/api/documents/upload'
    }
    
    path = feature_routes[feature]
    
    # Property: Should correctly identify feature from path
    identified_feature = middleware.get_feature_from_path(path)
    
    assert identified_feature == feature, \
        f"Should identify feature '{feature}' from path '{path}'"


@given(
    feature=st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image', 'pdf'])
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_database_error_defaults_to_enabled(feature):
    """
    Property: For any feature, if there's a database error when checking
    the feature status, the feature should default to enabled to avoid
    blocking legitimate requests.
    
    Validates: Requirements 16.3
    """
    # Mock Supabase client
    mock_supabase = Mock()
    
    # Mock table operations to raise exception
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    
    # Mock database error
    mock_eq.execute.side_effect = Exception("Database connection error")
    
    # Create middleware
    middleware = get_feature_toggle_middleware(mock_supabase)
    
    # Map feature to route
    feature_routes = {
        'chat': '/api/chat/sessions',
        'flashcard': '/api/commands/flashcard',
        'mcq': '/api/commands/mcq',
        'highyield': '/api/commands/highyield',
        'explain': '/api/commands/explain',
        'map': '/api/commands/map',
        'image': '/api/images/upload',
        'pdf': '/api/documents/upload'
    }
    
    # Create mock request
    mock_request = Mock(spec=Request)
    mock_request.url.path = feature_routes[feature]
    
    # Property: Database error should default to enabled (no exception)
    try:
        await middleware.check_feature_enabled(mock_request)
        # Should not raise exception
        assert True, "Database error should default to enabled"
    except HTTPException:
        pytest.fail("Database error should not block requests (should default to enabled)")
