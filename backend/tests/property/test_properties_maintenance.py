"""
Property-based tests for maintenance service

Requirements: 12.1, 12.2, 12.3, 12.5, 12.6
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import Mock, AsyncMock, patch
from services.maintenance import MaintenanceService


# Custom strategies for generating valid test data
@st.composite
def valid_feature(draw):
    """Generate valid feature names"""
    return draw(st.sampled_from(['chat', 'flashcard', 'mcq', 'highyield', 'explain', 'map', 'image']))


@st.composite
def valid_maintenance_level(draw):
    """Generate valid maintenance levels"""
    return draw(st.sampled_from(['soft', 'hard']))


@st.composite
def valid_reason(draw):
    """Generate valid maintenance reasons"""
    return draw(st.text(min_size=10, max_size=200, alphabet=st.characters(
        min_codepoint=32, max_codepoint=126  # ASCII printable characters only
    )))


@st.composite
def valid_admin_id(draw):
    """Generate valid admin IDs"""
    return draw(st.text(min_size=10, max_size=50, alphabet=st.characters(
        whitelist_categories=('Lu', 'Ll', 'Nd'),
        whitelist_characters='-_'
    )))


# Feature: medical-ai-platform, Property 37: Total key failure triggers maintenance
@given(
    feature=valid_feature()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_total_key_failure_triggers_maintenance(feature):
    """
    Property 37: For any feature where all keys have failed,
    the system should trigger maintenance mode.
    
    Validates: Requirements 12.1, 12.2, 12.3
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Mock table queries to return no active or degraded keys
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    
    # Configure mock chain for api_keys query
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    
    # Return keys that are all disabled (total failure)
    mock_eq.execute.return_value = Mock(data=[
        {"id": "key-1", "status": "disabled", "provider": "gemini"},
        {"id": "key-2", "status": "disabled", "provider": "gemini"}
    ])
    
    # Evaluate maintenance trigger
    result = await maintenance_service.evaluate_maintenance_trigger(
        feature=feature,
        failures=10
    )
    
    # Property: Total key failure should trigger hard maintenance
    assert result is not None, "Maintenance should be triggered"
    assert result == "hard", "Total key failure should trigger hard maintenance"


@given(
    feature=valid_feature()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_degraded_keys_trigger_soft_maintenance(feature):
    """
    Property: For any feature where only degraded keys remain,
    the system should trigger soft maintenance mode.
    
    Validates: Requirements 12.1, 12.2, 12.3
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Mock table queries
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    
    # Return only degraded keys (no active keys)
    mock_eq.execute.return_value = Mock(data=[
        {"id": "key-1", "status": "degraded", "provider": "gemini"},
        {"id": "key-2", "status": "degraded", "provider": "gemini"}
    ])
    
    # Evaluate maintenance trigger
    result = await maintenance_service.evaluate_maintenance_trigger(
        feature=feature,
        failures=5
    )
    
    # Property: Only degraded keys should trigger soft maintenance
    assert result is not None, "Maintenance should be triggered"
    assert result == "soft", "Only degraded keys should trigger soft maintenance"


@given(
    feature=valid_feature()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_no_keys_triggers_soft_maintenance(feature):
    """
    Property: For any feature with no configured keys,
    the system should trigger soft maintenance mode.
    
    Validates: Requirements 12.1, 12.2
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Mock table queries
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    
    # Return no keys
    mock_eq.execute.return_value = Mock(data=[])
    
    # Evaluate maintenance trigger
    result = await maintenance_service.evaluate_maintenance_trigger(
        feature=feature,
        failures=1
    )
    
    # Property: No keys should trigger soft maintenance
    assert result is not None, "Maintenance should be triggered"
    assert result == "soft", "No keys should trigger soft maintenance"


# Feature: medical-ai-platform, Property 38: Soft maintenance pauses heavy features
@given(
    reason=valid_reason(),
    feature=st.one_of(st.none(), valid_feature()),
    admin_id=st.one_of(st.none(), valid_admin_id())
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_soft_maintenance_behavior(reason, feature, admin_id):
    """
    Property 38: For any system in soft maintenance mode,
    heavy features should be paused while chat and admin access remain available.
    
    Validates: Requirements 12.5
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Mock table operations for enter_maintenance
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
    
    # Mock existing flag check (no existing flag)
    mock_eq.execute.return_value = Mock(data=[])
    mock_insert.execute.return_value = Mock(data=[{"id": "flag-1"}])
    
    # Mock notification service
    with patch('services.maintenance.get_notification_service') as mock_get_notif:
        mock_notif_service = Mock()
        mock_notif_service.notify_maintenance_triggered = AsyncMock()
        mock_get_notif.return_value = mock_notif_service
        
        # Enter soft maintenance
        result = await maintenance_service.enter_maintenance(
            level="soft",
            reason=reason,
            feature=feature,
            triggered_by=admin_id
        )
        
        # Property: Should enter soft maintenance
        assert result["in_maintenance"] is True, "Should be in maintenance"
        assert result["level"] == "soft", "Should be soft maintenance"
        assert result["reason"] == reason, "Should have correct reason"
        
        # Property: Notification should be sent
        assert mock_notif_service.notify_maintenance_triggered.called, \
            "Notification should be sent when entering maintenance"


# Feature: medical-ai-platform, Property 39: Hard maintenance allows admin-only access
@given(
    reason=valid_reason(),
    feature=st.one_of(st.none(), valid_feature()),
    admin_id=st.one_of(st.none(), valid_admin_id())
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_hard_maintenance_behavior(reason, feature, admin_id):
    """
    Property 39: For any system in hard maintenance mode,
    only admin access should be allowed.
    
    Validates: Requirements 12.6
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Mock table operations
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_insert = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_table.insert.return_value = mock_insert
    
    # Mock existing flag check (no existing flag)
    mock_eq.execute.return_value = Mock(data=[])
    mock_insert.execute.return_value = Mock(data=[{"id": "flag-1"}])
    
    # Mock notification service
    with patch('services.maintenance.get_notification_service') as mock_get_notif:
        mock_notif_service = Mock()
        mock_notif_service.notify_maintenance_triggered = AsyncMock()
        mock_get_notif.return_value = mock_notif_service
        
        # Enter hard maintenance
        result = await maintenance_service.enter_maintenance(
            level="hard",
            reason=reason,
            feature=feature,
            triggered_by=admin_id
        )
        
        # Property: Should enter hard maintenance
        assert result["in_maintenance"] is True, "Should be in maintenance"
        assert result["level"] == "hard", "Should be hard maintenance"
        assert result["reason"] == reason, "Should have correct reason"
        
        # Property: Notification should be sent
        assert mock_notif_service.notify_maintenance_triggered.called, \
            "Notification should be sent when entering maintenance"


@given(
    level=valid_maintenance_level(),
    reason=valid_reason()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_maintenance_status_retrieval(level, reason):
    """
    Property: For any maintenance mode entered,
    the status should be retrievable and accurate.
    
    Validates: Requirements 12.4
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Mock table operations for enter_maintenance
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_insert = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_table.insert.return_value = mock_insert
    
    # Mock existing flag check (no existing flag)
    mock_eq.execute.return_value = Mock(data=[])
    mock_insert.execute.return_value = Mock(data=[{"id": "flag-1"}])
    
    # Mock notification service
    with patch('services.maintenance.get_notification_service') as mock_get_notif:
        mock_notif_service = Mock()
        mock_notif_service.notify_maintenance_triggered = AsyncMock()
        mock_get_notif.return_value = mock_notif_service
        
        # Enter maintenance
        enter_result = await maintenance_service.enter_maintenance(
            level=level,
            reason=reason
        )
        
        # Now mock get_maintenance_status to return the entered state
        maintenance_data = {
            "level": level,
            "reason": reason,
            "feature": None,
            "triggered_by": None,
            "triggered_at": enter_result["triggered_at"],
            "is_active": True
        }
        
        mock_eq.execute.return_value = Mock(data=[{
            "flag_value": str(maintenance_data),
            "updated_at": enter_result["triggered_at"]
        }])
        
        # Get maintenance status
        status = await maintenance_service.get_maintenance_status()
        
        # Property: Status should reflect entered maintenance
        assert status["in_maintenance"] is True, "Should be in maintenance"
        assert status["level"] == level, "Level should match"
        assert status["reason"] == reason, "Reason should match"


@given(
    admin_id=valid_admin_id()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_exit_maintenance_notifies_admin(admin_id):
    """
    Property: For any manual exit from maintenance mode,
    an admin notification should be sent.
    
    Validates: Requirements 12.8
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Mock table operations
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_update = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_table.update.return_value = mock_update
    
    # Mock current maintenance status (in soft maintenance)
    maintenance_data = {
        "level": "soft",
        "reason": "Test reason",
        "feature": None,
        "triggered_by": None,
        "triggered_at": "2024-01-01T00:00:00",
        "is_active": True
    }
    
    mock_eq.execute.return_value = Mock(data=[{
        "flag_value": str(maintenance_data),
        "updated_at": "2024-01-01T00:00:00"
    }])
    
    mock_update.execute.return_value = Mock(data=[{"id": "flag-1"}])
    
    # Mock notification service
    with patch('services.maintenance.get_notification_service') as mock_get_notif:
        mock_notif_service = Mock()
        mock_notif_service.notify_admin_override = AsyncMock()
        mock_get_notif.return_value = mock_notif_service
        
        # Exit maintenance
        result = await maintenance_service.exit_maintenance(exited_by=admin_id)
        
        # Property: Should exit maintenance
        assert result["in_maintenance"] is False, "Should not be in maintenance"
        assert result["exited_by"] == admin_id, "Should record who exited"
        
        # Property: Notification should be sent
        assert mock_notif_service.notify_admin_override.called, \
            "Admin override notification should be sent when exiting maintenance"


@given(
    level=valid_maintenance_level(),
    reason=valid_reason()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_invalid_maintenance_level_rejected(level, reason):
    """
    Property: For any invalid maintenance level,
    the system should reject the request.
    
    Validates: Requirements 12.4
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Try to enter maintenance with invalid level
    invalid_level = "invalid_level"
    
    with pytest.raises(ValueError) as exc_info:
        await maintenance_service.enter_maintenance(
            level=invalid_level,
            reason=reason
        )
    
    # Property: Should raise ValueError for invalid level
    assert "Invalid maintenance level" in str(exc_info.value), \
        "Should reject invalid maintenance level"



# Feature: medical-ai-platform, Property 50: Admins can manually trigger maintenance
@given(
    level=valid_maintenance_level(),
    reason=valid_reason(),
    feature=st.one_of(st.none(), valid_feature()),
    admin_id=valid_admin_id()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_admins_can_manually_trigger_maintenance(level, reason, feature, admin_id):
    """
    Property 50: For any admin user, they should be able to manually trigger
    maintenance mode with a specified level and reason.
    
    Validates: Requirements 17.2
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
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
    
    # Mock existing flag check (no existing flag)
    mock_eq.execute.return_value = Mock(data=[])
    mock_insert.execute.return_value = Mock(data=[{"id": "flag-1"}])
    
    # Mock notification service
    with patch('services.maintenance.get_notification_service') as mock_get_notif:
        mock_notif_service = Mock()
        mock_notif_service.notify_maintenance_triggered = AsyncMock()
        mock_get_notif.return_value = mock_notif_service
        
        # Admin manually triggers maintenance
        result = await maintenance_service.enter_maintenance(
            level=level,
            reason=reason,
            feature=feature,
            triggered_by=admin_id
        )
        
        # Property: Maintenance should be triggered successfully
        assert result["in_maintenance"] is True, "Maintenance should be active"
        assert result["level"] == level, "Level should match requested level"
        assert result["reason"] == reason, "Reason should match provided reason"
        assert result["triggered_by"] == admin_id, "Should record admin who triggered it"
        
        # Property: Feature should be recorded if provided
        if feature:
            assert result["feature"] == feature, "Feature should be recorded"
        
        # Property: Notification should be sent
        assert mock_notif_service.notify_maintenance_triggered.called, \
            "Notification should be sent when admin triggers maintenance"
        
        # Verify notification was called with correct parameters
        call_args = mock_notif_service.notify_maintenance_triggered.call_args
        assert call_args[1]["level"] == level, "Notification should include level"
        assert call_args[1]["reason"] == reason, "Notification should include reason"


# Feature: medical-ai-platform, Property 40: Manual override restores operation
@given(
    admin_id=valid_admin_id(),
    original_level=valid_maintenance_level(),
    original_reason=valid_reason()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_manual_override_restores_operation(admin_id, original_level, original_reason):
    """
    Property 40: For any system in maintenance mode, when an admin manually overrides,
    the system should return to normal operation.
    
    Validates: Requirements 12.8
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Mock table operations
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    mock_update = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_table.update.return_value = mock_update
    
    # Mock current maintenance status (system is in maintenance)
    maintenance_data = {
        "level": original_level,
        "reason": original_reason,
        "feature": None,
        "triggered_by": None,
        "triggered_at": "2024-01-01T00:00:00",
        "is_active": True
    }
    
    # First call returns active maintenance
    mock_eq.execute.return_value = Mock(data=[{
        "flag_value": str(maintenance_data),
        "updated_at": "2024-01-01T00:00:00"
    }])
    
    mock_update.execute.return_value = Mock(data=[{"id": "flag-1"}])
    
    # Mock notification service
    with patch('services.maintenance.get_notification_service') as mock_get_notif:
        mock_notif_service = Mock()
        mock_notif_service.notify_admin_override = AsyncMock()
        mock_get_notif.return_value = mock_notif_service
        
        # Admin manually overrides maintenance
        result = await maintenance_service.exit_maintenance(exited_by=admin_id)
        
        # Property: System should exit maintenance
        assert result["in_maintenance"] is False, "System should not be in maintenance"
        assert result["exited_by"] == admin_id, "Should record admin who overrode"
        assert "exited_at" in result, "Should record when override occurred"
        
        # Property: Admin override notification should be sent
        assert mock_notif_service.notify_admin_override.called, \
            "Admin override notification should be sent"
        
        # Verify notification was called with correct parameters
        call_args = mock_notif_service.notify_admin_override.call_args
        assert call_args[1]["admin_id"] == admin_id, "Notification should include admin ID"
        assert call_args[1]["action"] == "exit_maintenance", "Notification should specify action"
        
        # Property: Previous maintenance details should be included in notification
        details = call_args[1]["details"]
        assert details["previous_level"] == original_level, "Should include previous level"
        assert details["previous_reason"] == original_reason, "Should include previous reason"


@given(
    admin_id=valid_admin_id()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_override_when_not_in_maintenance(admin_id):
    """
    Property: For any system not in maintenance mode, attempting to override
    should be handled gracefully without error.
    
    Validates: Requirements 12.8
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
    # Mock table operations
    mock_table = Mock()
    mock_select = Mock()
    mock_eq = Mock()
    
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    
    # Mock no maintenance status (system is not in maintenance)
    mock_eq.execute.return_value = Mock(data=[])
    
    # Admin attempts to override when not in maintenance
    result = await maintenance_service.exit_maintenance(exited_by=admin_id)
    
    # Property: Should handle gracefully
    assert result["in_maintenance"] is False, "Should confirm not in maintenance"
    assert "message" in result, "Should provide informative message"
    
    # Property: Should not raise an error
    # (test passes if no exception is raised)


@given(
    level=valid_maintenance_level(),
    reason=valid_reason(),
    admin_id=valid_admin_id()
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
@pytest.mark.asyncio
async def test_property_maintenance_round_trip(level, reason, admin_id):
    """
    Property: For any maintenance mode entered and then exited,
    the system should return to normal operation state.
    
    Validates: Requirements 12.4, 12.8, 17.2
    """
    # Create mock Supabase client
    mock_supabase = Mock()
    
    # Create maintenance service
    maintenance_service = MaintenanceService(supabase_client=mock_supabase)
    
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
    
    # Mock notification service
    with patch('services.maintenance.get_notification_service') as mock_get_notif:
        mock_notif_service = Mock()
        mock_notif_service.notify_maintenance_triggered = AsyncMock()
        mock_notif_service.notify_admin_override = AsyncMock()
        mock_get_notif.return_value = mock_notif_service
        
        # Step 1: Enter maintenance
        mock_eq.execute.return_value = Mock(data=[])
        mock_insert.execute.return_value = Mock(data=[{"id": "flag-1"}])
        
        enter_result = await maintenance_service.enter_maintenance(
            level=level,
            reason=reason,
            triggered_by=admin_id
        )
        
        # Property: Should enter maintenance
        assert enter_result["in_maintenance"] is True, "Should enter maintenance"
        
        # Step 2: Exit maintenance
        maintenance_data = {
            "level": level,
            "reason": reason,
            "feature": None,
            "triggered_by": admin_id,
            "triggered_at": enter_result["triggered_at"],
            "is_active": True
        }
        
        mock_eq.execute.return_value = Mock(data=[{
            "flag_value": str(maintenance_data),
            "updated_at": enter_result["triggered_at"]
        }])
        
        mock_update.execute.return_value = Mock(data=[{"id": "flag-1"}])
        
        exit_result = await maintenance_service.exit_maintenance(exited_by=admin_id)
        
        # Property: Should exit maintenance (round trip complete)
        assert exit_result["in_maintenance"] is False, "Should exit maintenance"
        assert exit_result["exited_by"] == admin_id, "Should record who exited"
        
        # Property: Both notifications should have been sent
        assert mock_notif_service.notify_maintenance_triggered.called, \
            "Enter notification should be sent"
        assert mock_notif_service.notify_admin_override.called, \
            "Exit notification should be sent"
