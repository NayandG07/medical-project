"""
Property-based tests for rate limiting service
Tests universal properties that should hold for all valid inputs
Requirements: 9.2, 9.3, 9.5, 9.6
"""
import pytest
from hypothesis import given, strategies as st, settings, assume
from unittest.mock import MagicMock
from datetime import date
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from services.rate_limiter import RateLimiter, PLAN_LIMITS


# Custom strategies for generating valid test data
@st.composite
def valid_user_id(draw):
    """Generate valid UUID-like user IDs"""
    return draw(st.uuids()).hex


@st.composite
def valid_plan(draw):
    """Generate valid user plans"""
    return draw(st.sampled_from(['free', 'student', 'pro', 'admin']))


@st.composite
def valid_admin_role(draw):
    """Generate valid admin roles"""
    return draw(st.sampled_from(['super_admin', 'admin', 'ops', 'support', 'viewer']))


@st.composite
def valid_feature(draw):
    """Generate valid feature names"""
    return draw(st.sampled_from(['chat', 'mcq', 'flashcard', 'pdf', 'image']))


@st.composite
def valid_usage_data(draw, plan):
    """Generate valid usage data within or exceeding plan limits"""
    limits = PLAN_LIMITS[plan]
    
    # Generate usage that might be within or over limits
    return {
        'tokens_used': draw(st.integers(min_value=0, max_value=int(limits['daily_tokens'] * 1.5) if limits['daily_tokens'] != float('inf') else 100000)),
        'requests_count': draw(st.integers(min_value=0, max_value=int(limits['daily_requests'] * 1.5) if limits['daily_requests'] != float('inf') else 1000)),
        'pdf_uploads': draw(st.integers(min_value=0, max_value=int(limits['pdf_uploads'] * 1.5) if limits['pdf_uploads'] != float('inf') else 100)),
        'mcqs_generated': draw(st.integers(min_value=0, max_value=int(limits['mcqs_per_day'] * 1.5) if limits['mcqs_per_day'] != float('inf') else 500)),
        'images_used': draw(st.integers(min_value=0, max_value=int(limits['images_per_day'] * 1.5) if limits['images_per_day'] != float('inf') else 100)),
        'flashcards_generated': draw(st.integers(min_value=0, max_value=int(limits['flashcards_per_day'] * 1.5) if limits['flashcards_per_day'] != float('inf') else 1000)),
    }


# Feature: medical-ai-platform, Property 21: Rate limits are checked before processing
@given(
    user_id=valid_user_id(),
    plan=valid_plan(),
    feature=valid_feature(),
    role=st.one_of(st.none(), valid_admin_role()),
    data=st.data()
)
@settings(max_examples=100)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_rate_limits_checked_before_processing(user_id, plan, feature, role, data):
    """
    Property 21: For any user request, the system should check current usage 
    against plan limits before processing the request.
    
    Validates: Requirements 9.2
    """
    # Create mock Supabase client
    mock_supabase = MagicMock()
    
    # Mock user table response
    user_data = {
        "plan": plan,
        "role": role
    }
    mock_user_response = MagicMock()
    mock_user_response.data = [user_data]
    
    # Generate usage data for this plan using st.data()
    usage_data = data.draw(valid_usage_data(plan))
    
    # Mock usage_counters table response
    mock_usage_response = MagicMock()
    mock_usage_response.data = [{
        "id": "usage-id-123",
        "user_id": user_id,
        "date": str(date.today()),
        **usage_data
    }]
    
    # Set up mock table calls
    def mock_table_select(table_name):
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_eq2 = MagicMock()
        
        if table_name == "users":
            mock_eq.execute.return_value = mock_user_response
            mock_select.eq.return_value = mock_eq
        elif table_name == "usage_counters":
            mock_eq2.execute.return_value = mock_usage_response
            mock_eq.eq.return_value = mock_eq2
            mock_select.eq.return_value = mock_eq
        
        mock_table.select.return_value = mock_select
        return mock_table
    
    mock_supabase.table.side_effect = mock_table_select
    
    # Create rate limiter with mock client
    rate_limiter = RateLimiter(supabase_client=mock_supabase)
    
    # Check rate limit
    result = await rate_limiter.check_rate_limit(user_id, feature)
    
    # Property: Rate limit check should always return a boolean
    assert isinstance(result, bool), f"Rate limit check should return boolean, got {type(result)}"
    
    # Property: The check should have queried the user table
    assert any(call[0][0] == "users" for call in mock_supabase.table.call_args_list), \
        "Rate limit check should query users table"
    
    # Property: The check should have queried usage_counters table (unless admin bypass)
    if role not in ["super_admin", "admin", "ops"]:
        assert any(call[0][0] == "usage_counters" for call in mock_supabase.table.call_args_list), \
            "Rate limit check should query usage_counters table for non-admin users"


# Feature: medical-ai-platform, Property 22: Requests over limit are rejected
@given(
    user_id=valid_user_id(),
    plan=st.sampled_from(['free', 'student', 'pro']),  # Exclude admin (infinite limits)
    feature=valid_feature()
)
@settings(max_examples=100)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_requests_over_limit_rejected(user_id, plan, feature):
    """
    Property 22: For any user request that would exceed plan limits, 
    the request should be rejected with a clear error message.
    
    Validates: Requirements 9.3
    """
    # Create mock Supabase client
    mock_supabase = MagicMock()
    
    # Mock user table response (non-admin user)
    user_data = {
        "plan": plan,
        "role": None
    }
    mock_user_response = MagicMock()
    mock_user_response.data = [user_data]
    
    # Get plan limits
    limits = PLAN_LIMITS[plan]
    
    # Create usage data that EXCEEDS limits
    # We'll exceed at least one limit to ensure rejection
    usage_data = {
        'tokens_used': int(limits['daily_tokens'] + 1),  # Over token limit
        'requests_count': int(limits['daily_requests'] + 1),  # Over request limit
        'pdf_uploads': int(limits['pdf_uploads'] + 1) if limits['pdf_uploads'] > 0 else 0,
        'mcqs_generated': int(limits['mcqs_per_day'] + 1) if limits['mcqs_per_day'] > 0 else 0,
        'images_used': int(limits['images_per_day'] + 1) if limits['images_per_day'] > 0 else 0,
        'flashcards_generated': int(limits['flashcards_per_day'] + 1) if limits['flashcards_per_day'] > 0 else 0,
    }
    
    # Mock usage_counters table response
    mock_usage_response = MagicMock()
    mock_usage_response.data = [{
        "id": "usage-id-123",
        "user_id": user_id,
        "date": str(date.today()),
        **usage_data
    }]
    
    # Set up mock table calls
    def mock_table_select(table_name):
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_eq2 = MagicMock()
        
        if table_name == "users":
            mock_eq.execute.return_value = mock_user_response
            mock_select.eq.return_value = mock_eq
        elif table_name == "usage_counters":
            mock_eq2.execute.return_value = mock_usage_response
            mock_eq.eq.return_value = mock_eq2
            mock_select.eq.return_value = mock_eq
        
        mock_table.select.return_value = mock_select
        return mock_table
    
    mock_supabase.table.side_effect = mock_table_select
    
    # Create rate limiter with mock client
    rate_limiter = RateLimiter(supabase_client=mock_supabase)
    
    # Check rate limit
    result = await rate_limiter.check_rate_limit(user_id, feature)
    
    # Property: Request should be rejected (return False) when over limit
    assert result is False, \
        f"Request should be rejected when usage exceeds limits. Plan: {plan}, Usage: {usage_data}, Limits: {limits}"


# Feature: medical-ai-platform, Property 24: Admin users bypass rate limits
@given(
    user_id=valid_user_id(),
    plan=valid_plan(),
    admin_role=st.sampled_from(['super_admin', 'admin', 'ops']),  # Admin roles that bypass
    feature=valid_feature()
)
@settings(max_examples=100)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_admin_users_bypass_rate_limits(user_id, plan, admin_role, feature):
    """
    Property 24: For any user with admin role, requests should never be 
    rejected due to rate limits.
    
    Validates: Requirements 9.5
    """
    # Create mock Supabase client
    mock_supabase = MagicMock()
    
    # Mock user table response with admin role
    user_data = {
        "plan": plan,
        "role": admin_role
    }
    mock_user_response = MagicMock()
    mock_user_response.data = [user_data]
    
    # Create usage data that would normally EXCEED limits
    # Even with massive usage, admin should bypass
    usage_data = {
        'tokens_used': 999999999,
        'requests_count': 999999999,
        'pdf_uploads': 999999999,
        'mcqs_generated': 999999999,
        'images_used': 999999999,
        'flashcards_generated': 999999999,
    }
    
    # Mock usage_counters table response
    mock_usage_response = MagicMock()
    mock_usage_response.data = [{
        "id": "usage-id-123",
        "user_id": user_id,
        "date": str(date.today()),
        **usage_data
    }]
    
    # Set up mock table calls
    def mock_table_select(table_name):
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_eq2 = MagicMock()
        
        if table_name == "users":
            mock_eq.execute.return_value = mock_user_response
            mock_select.eq.return_value = mock_eq
        elif table_name == "usage_counters":
            mock_eq2.execute.return_value = mock_usage_response
            mock_eq.eq.return_value = mock_eq2
            mock_select.eq.return_value = mock_eq
        
        mock_table.select.return_value = mock_select
        return mock_table
    
    mock_supabase.table.side_effect = mock_table_select
    
    # Create rate limiter with mock client
    rate_limiter = RateLimiter(supabase_client=mock_supabase)
    
    # Check rate limit
    result = await rate_limiter.check_rate_limit(user_id, feature)
    
    # Property: Admin users should ALWAYS pass rate limit checks
    assert result is True, \
        f"Admin users should bypass rate limits. Role: {admin_role}, Result: {result}"


# Feature: medical-ai-platform, Property 25: Multi-level rate limiting
@given(
    user_id=valid_user_id(),
    plan=st.sampled_from(['free', 'student', 'pro']),  # Exclude admin
    feature=valid_feature()
)
@settings(max_examples=100)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_multi_level_rate_limiting(user_id, plan, feature):
    """
    Property 25: For any request, the system should enforce limits at token level, 
    feature level, and plan level (all three must pass).
    
    Validates: Requirements 9.6
    """
    # Create mock Supabase client
    mock_supabase = MagicMock()
    
    # Mock user table response (non-admin)
    user_data = {
        "plan": plan,
        "role": None
    }
    mock_user_response = MagicMock()
    mock_user_response.data = [user_data]
    
    # Get plan limits
    limits = PLAN_LIMITS[plan]
    
    # Test Case 1: Token limit exceeded (should fail)
    usage_over_tokens = {
        'tokens_used': int(limits['daily_tokens'] + 1),
        'requests_count': 0,
        'pdf_uploads': 0,
        'mcqs_generated': 0,
        'images_used': 0,
        'flashcards_generated': 0,
    }
    
    mock_usage_response = MagicMock()
    mock_usage_response.data = [{
        "id": "usage-id-123",
        "user_id": user_id,
        "date": str(date.today()),
        **usage_over_tokens
    }]
    
    def mock_table_select(table_name):
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_eq2 = MagicMock()
        
        if table_name == "users":
            mock_eq.execute.return_value = mock_user_response
            mock_select.eq.return_value = mock_eq
        elif table_name == "usage_counters":
            mock_eq2.execute.return_value = mock_usage_response
            mock_eq.eq.return_value = mock_eq2
            mock_select.eq.return_value = mock_eq
        
        mock_table.select.return_value = mock_select
        return mock_table
    
    mock_supabase.table.side_effect = mock_table_select
    
    rate_limiter = RateLimiter(supabase_client=mock_supabase)
    result = await rate_limiter.check_rate_limit(user_id, feature)
    
    # Property: Should fail when token limit exceeded
    assert result is False, \
        f"Should reject when token limit exceeded. Tokens used: {usage_over_tokens['tokens_used']}, Limit: {limits['daily_tokens']}"
    
    # Test Case 2: Request limit exceeded (should fail)
    usage_over_requests = {
        'tokens_used': 0,
        'requests_count': int(limits['daily_requests'] + 1),
        'pdf_uploads': 0,
        'mcqs_generated': 0,
        'images_used': 0,
        'flashcards_generated': 0,
    }
    
    mock_usage_response.data = [{
        "id": "usage-id-123",
        "user_id": user_id,
        "date": str(date.today()),
        **usage_over_requests
    }]
    
    mock_supabase.table.side_effect = mock_table_select
    rate_limiter = RateLimiter(supabase_client=mock_supabase)
    result = await rate_limiter.check_rate_limit(user_id, feature)
    
    # Property: Should fail when request limit exceeded
    assert result is False, \
        f"Should reject when request limit exceeded. Requests: {usage_over_requests['requests_count']}, Limit: {limits['daily_requests']}"
    
    # Test Case 3: Feature-specific limit exceeded (should fail for that feature)
    if feature == 'mcq' and limits['mcqs_per_day'] > 0:
        usage_over_feature = {
            'tokens_used': 0,
            'requests_count': 0,
            'pdf_uploads': 0,
            'mcqs_generated': int(limits['mcqs_per_day'] + 1),
            'images_used': 0,
            'flashcards_generated': 0,
        }
        
        mock_usage_response.data = [{
            "id": "usage-id-123",
            "user_id": user_id,
            "date": str(date.today()),
            **usage_over_feature
        }]
        
        mock_supabase.table.side_effect = mock_table_select
        rate_limiter = RateLimiter(supabase_client=mock_supabase)
        result = await rate_limiter.check_rate_limit(user_id, feature)
        
        # Property: Should fail when feature-specific limit exceeded
        assert result is False, \
            f"Should reject when MCQ limit exceeded. MCQs: {usage_over_feature['mcqs_generated']}, Limit: {limits['mcqs_per_day']}"
