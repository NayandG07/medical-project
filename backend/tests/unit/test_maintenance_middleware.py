"""
Unit tests for maintenance middleware
Requirements: 12.5, 12.6
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, Request
from middleware.maintenance import MaintenanceMiddleware, get_maintenance_middleware


@pytest.fixture
def mock_supabase():
    """Mock Supabase client"""
    return MagicMock()


@pytest.fixture
def maintenance_middleware(mock_supabase):
    """Create maintenance middleware instance with mocked Supabase"""
    return MaintenanceMiddleware(mock_supabase)


@pytest.fixture
def mock_request():
    """Create a mock FastAPI request"""
    request = MagicMock(spec=Request)
    request.url = MagicMock()
    return request


class TestMaintenanceMiddleware:
    """Tests for MaintenanceMiddleware class"""
    
    @pytest.mark.asyncio
    async def test_no_maintenance_allows_all_requests(self, maintenance_middleware, mock_request, mock_supabase):
        """
        Test that when not in maintenance mode, all requests are allowed
        """
        # Mock no maintenance mode
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )
        
        mock_request.url.path = "/api/chat/sessions"
        
        # Should not raise any exception
        await maintenance_middleware.check_maintenance(mock_request, user_id="test-user")
    
    @pytest.mark.asyncio
    async def test_inactive_maintenance_allows_all_requests(self, maintenance_middleware, mock_request, mock_supabase):
        """
        Test that when maintenance is inactive, all requests are allowed
        """
        # Mock inactive maintenance mode
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "flag_value": str({
                    "level": "soft",
                    "reason": "Testing",
                    "is_active": False
                })
            }]
        )
        
        mock_request.url.path = "/api/chat/sessions"
        
        # Should not raise any exception
        await maintenance_middleware.check_maintenance(mock_request, user_id="test-user")
    
    @pytest.mark.asyncio
    async def test_soft_maintenance_blocks_heavy_features(self, maintenance_middleware, mock_request, mock_supabase):
        """
        Test that soft maintenance blocks heavy features (PDF, images)
        Requirement 12.5: Soft maintenance pauses heavy features
        """
        # Mock soft maintenance mode
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "flag_value": str({
                    "level": "soft",
                    "reason": "API quota exhausted",
                    "is_active": True
                })
            }]
        )
        
        # Test PDF upload endpoint (heavy feature)
        mock_request.url.path = "/api/documents/upload"
        
        with pytest.raises(HTTPException) as exc_info:
            await maintenance_middleware.check_maintenance(mock_request, user_id="test-user")
        
        assert exc_info.value.status_code == 503
        assert "MAINTENANCE_MODE" in str(exc_info.value.detail)
        assert "soft" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_soft_maintenance_allows_chat(self, maintenance_middleware, mock_request, mock_supabase):
        """
        Test that soft maintenance allows chat requests
        Requirement 12.5: Soft maintenance allows chat
        """
        # Mock soft maintenance mode
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "flag_value": str({
                    "level": "soft",
                    "reason": "API quota exhausted",
                    "is_active": True
                })
            }]
        )
        
        # Test chat endpoint (light feature)
        mock_request.url.path = "/api/chat/sessions"
        
        # Should not raise any exception
        await maintenance_middleware.check_maintenance(mock_request, user_id="test-user")
    
    @pytest.mark.asyncio
    async def test_soft_maintenance_allows_admin_routes(self, maintenance_middleware, mock_request, mock_supabase):
        """
        Test that soft maintenance allows admin routes
        Requirement 12.5: Soft maintenance allows admin access
        """
        # Mock soft maintenance mode
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "flag_value": str({
                    "level": "soft",
                    "reason": "API quota exhausted",
                    "is_active": True
                })
            }]
        )
        
        # Test admin endpoint
        mock_request.url.path = "/api/admin/users"
        
        # Should not raise any exception
        await maintenance_middleware.check_maintenance(mock_request, user_id="test-user")
    
    @pytest.mark.asyncio
    async def test_hard_maintenance_blocks_non_admin(self, maintenance_middleware, mock_request, mock_supabase):
        """
        Test that hard maintenance blocks all non-admin requests
        Requirement 12.6: Hard maintenance allows admin-only access
        """
        # Create a mock that returns different values for different table queries
        def mock_table_query(table_name):
            mock_chain = MagicMock()
            
            if table_name == "system_flags":
                # Return hard maintenance mode
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[{
                        "flag_value": str({
                            "level": "hard",
                            "reason": "All API keys failed",
                            "is_active": True
                        })
                    }]
                )
            elif table_name == "users":
                # Return non-admin user
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[{
                        "email": "user@example.com",
                        "role": None
                    }]
                )
            elif table_name == "admin_allowlist":
                # Return empty allowlist
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[]
                )
            
            return mock_chain
        
        mock_supabase.table.side_effect = mock_table_query
        
        # Test chat endpoint
        mock_request.url.path = "/api/chat/sessions"
        
        with pytest.raises(HTTPException) as exc_info:
            await maintenance_middleware.check_maintenance(mock_request, user_id="test-user")
        
        assert exc_info.value.status_code == 503
        assert "MAINTENANCE_MODE" in str(exc_info.value.detail)
        assert "hard" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_hard_maintenance_allows_admin_users(self, maintenance_middleware, mock_request, mock_supabase):
        """
        Test that hard maintenance allows admin users
        Requirement 12.6: Hard maintenance allows admin-only access
        """
        # Create a mock that returns different values for different table queries
        def mock_table_query(table_name):
            mock_chain = MagicMock()
            
            if table_name == "system_flags":
                # Return hard maintenance mode
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[{
                        "flag_value": str({
                            "level": "hard",
                            "reason": "All API keys failed",
                            "is_active": True
                        })
                    }]
                )
            elif table_name == "users":
                # Return admin user
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[{
                        "email": "admin@example.com",
                        "role": "super_admin"
                    }]
                )
            elif table_name == "admin_allowlist":
                # Return admin in allowlist
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[{
                        "role": "super_admin"
                    }]
                )
            
            return mock_chain
        
        mock_supabase.table.side_effect = mock_table_query
        
        # Test chat endpoint with admin user
        mock_request.url.path = "/api/chat/sessions"
        
        # Should not raise any exception for admin user
        await maintenance_middleware.check_maintenance(mock_request, user_id="admin-user")
    
    @pytest.mark.asyncio
    async def test_hard_maintenance_allows_admin_routes(self, maintenance_middleware, mock_request, mock_supabase):
        """
        Test that hard maintenance always allows admin routes
        """
        # Mock hard maintenance mode
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "flag_value": str({
                    "level": "hard",
                    "reason": "All API keys failed",
                    "is_active": True
                })
            }]
        )
        
        # Test admin endpoint (should always be allowed)
        mock_request.url.path = "/api/admin/maintenance"
        
        # Should not raise any exception
        await maintenance_middleware.check_maintenance(mock_request, user_id="test-user")
    
    @pytest.mark.asyncio
    async def test_health_endpoint_always_allowed(self, maintenance_middleware, mock_request, mock_supabase):
        """
        Test that health endpoint is always allowed regardless of maintenance mode
        """
        # Mock hard maintenance mode
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "flag_value": str({
                    "level": "hard",
                    "reason": "All API keys failed",
                    "is_active": True
                })
            }]
        )
        
        # Test health endpoint
        mock_request.url.path = "/api/health"
        
        # Should not raise any exception
        await maintenance_middleware.check_maintenance(mock_request, user_id="test-user")
    
    @pytest.mark.asyncio
    async def test_is_admin_user_with_super_admin_email(self, maintenance_middleware, mock_supabase):
        """
        Test that users with SUPER_ADMIN_EMAIL are recognized as admins
        """
        # Mock user query
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "email": "super@example.com",
                "role": None
            }]
        )
        
        with patch.dict('os.environ', {'SUPER_ADMIN_EMAIL': 'super@example.com'}):
            is_admin = await maintenance_middleware.is_admin_user("test-user")
            assert is_admin is True
    
    @pytest.mark.asyncio
    async def test_is_admin_user_with_allowlist(self, maintenance_middleware, mock_supabase):
        """
        Test that users in admin_allowlist with role are recognized as admins
        """
        # Create a mock that returns different values for different table queries
        def mock_table_query(table_name):
            mock_chain = MagicMock()
            
            if table_name == "users":
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[{
                        "email": "admin@example.com",
                        "role": "admin"
                    }]
                )
            elif table_name == "admin_allowlist":
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[{
                        "role": "admin"
                    }]
                )
            
            return mock_chain
        
        mock_supabase.table.side_effect = mock_table_query
        
        is_admin = await maintenance_middleware.is_admin_user("test-user")
        assert is_admin is True
    
    @pytest.mark.asyncio
    async def test_is_admin_user_non_admin(self, maintenance_middleware, mock_supabase):
        """
        Test that regular users are not recognized as admins
        """
        # Create a mock that returns different values for different table queries
        def mock_table_query(table_name):
            mock_chain = MagicMock()
            
            if table_name == "users":
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[{
                        "email": "user@example.com",
                        "role": None
                    }]
                )
            elif table_name == "admin_allowlist":
                mock_chain.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=[]
                )
            
            return mock_chain
        
        mock_supabase.table.side_effect = mock_table_query
        
        is_admin = await maintenance_middleware.is_admin_user("test-user")
        assert is_admin is False
    
    def test_is_heavy_feature(self, maintenance_middleware):
        """Test that heavy features are correctly identified"""
        assert maintenance_middleware.is_heavy_feature("/api/documents/upload") is True
        assert maintenance_middleware.is_heavy_feature("/api/images/analyze") is True
        assert maintenance_middleware.is_heavy_feature("/api/chat/sessions") is False
        assert maintenance_middleware.is_heavy_feature("/api/admin/users") is False
    
    def test_is_admin_route(self, maintenance_middleware):
        """Test that admin routes are correctly identified"""
        assert maintenance_middleware.is_admin_route("/api/admin/users") is True
        assert maintenance_middleware.is_admin_route("/api/admin/api-keys") is True
        assert maintenance_middleware.is_admin_route("/api/health") is True
        assert maintenance_middleware.is_admin_route("/api/chat/sessions") is False
        assert maintenance_middleware.is_admin_route("/api/documents/upload") is False


class TestGetMaintenanceMiddleware:
    """Tests for get_maintenance_middleware singleton function"""
    
    def test_singleton_returns_same_instance(self, mock_supabase):
        """Test that get_maintenance_middleware returns the same instance"""
        instance1 = get_maintenance_middleware(mock_supabase)
        instance2 = get_maintenance_middleware()
        
        assert instance1 is instance2
    
    def test_new_client_creates_new_instance(self, mock_supabase):
        """Test that providing a new client creates a new instance"""
        instance1 = get_maintenance_middleware(mock_supabase)
        
        new_mock_supabase = MagicMock()
        instance2 = get_maintenance_middleware(new_mock_supabase)
        
        # Should be different instances when new client is provided
        assert instance1 is not instance2
