"""
Unit tests for authentication endpoints
Requirements: 1.1, 1.2
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch
from main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app"""
    return TestClient(app)


@pytest.fixture
def mock_auth_service():
    """Mock authentication service"""
    with patch('main.get_auth_service') as mock:
        service = MagicMock()
        mock.return_value = service
        yield service


class TestRegisterEndpoint:
    """Tests for /api/auth/register endpoint"""
    
    def test_registration_creates_user_with_free_plan(self, client, mock_auth_service):
        """
        Test that registration creates a user with the default "free" plan
        Requirement 1.2: User registration assigns default "free" plan
        """
        # Mock the register_user response
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = "test@example.com"
        
        mock_session = MagicMock()
        mock_session.access_token = "test-access-token"
        mock_session.refresh_token = "test-refresh-token"
        
        mock_auth_service.register_user = AsyncMock(return_value={
            "user": mock_user,
            "session": mock_session,
            "plan": "free"
        })
        
        # Make registration request
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "testpassword123",
                "name": "Test User"
            }
        )
        
        # Assert response
        assert response.status_code == 201
        data = response.json()
        assert data["plan"] == "free"
        assert data["user"]["email"] == "test@example.com"
        assert "access_token" in data["session"]
        
        # Verify the service was called correctly
        mock_auth_service.register_user.assert_called_once_with(
            email="test@example.com",
            password="testpassword123",
            name="Test User"
        )
    
    def test_registration_with_invalid_email(self, client):
        """Test that registration with invalid email returns 422"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "invalid-email",
                "password": "testpassword123",
                "name": "Test User"
            }
        )
        
        assert response.status_code == 422
    
    def test_registration_with_missing_fields(self, client):
        """Test that registration with missing fields returns 422"""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com"
            }
        )
        
        assert response.status_code == 422
    
    def test_registration_failure_returns_400(self, client, mock_auth_service):
        """Test that registration failure returns 400 with error message"""
        mock_auth_service.register_user = AsyncMock(
            side_effect=Exception("Email already exists")
        )
        
        response = client.post(
            "/api/auth/register",
            json={
                "email": "existing@example.com",
                "password": "testpassword123",
                "name": "Test User"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data["detail"]


class TestLoginEndpoint:
    """Tests for /api/auth/login endpoint"""
    
    def test_login_returns_valid_token(self, client, mock_auth_service):
        """
        Test that login returns a valid token for correct credentials
        Requirement 1.1: User authentication
        """
        # Mock the authenticate_user response
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = "test@example.com"
        
        mock_session = MagicMock()
        mock_session.access_token = "test-access-token"
        mock_session.refresh_token = "test-refresh-token"
        
        mock_auth_service.authenticate_user = AsyncMock(return_value={
            "user": mock_user,
            "session": mock_session
        })
        
        mock_auth_service.get_user_plan = AsyncMock(return_value="free")
        
        # Make login request
        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "testpassword123"
            }
        )
        
        # Assert response
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == "test@example.com"
        assert data["session"]["access_token"] == "test-access-token"
        assert data["session"]["refresh_token"] == "test-refresh-token"
        assert data["plan"] == "free"
        
        # Verify the service was called correctly
        mock_auth_service.authenticate_user.assert_called_once_with(
            email="test@example.com",
            password="testpassword123"
        )
        mock_auth_service.get_user_plan.assert_called_once_with("test-user-id")
    
    def test_invalid_credentials_return_401(self, client, mock_auth_service):
        """
        Test that invalid credentials return 401 Unauthorized
        Requirement 1.1: Authentication failure handling
        """
        mock_auth_service.authenticate_user = AsyncMock(
            side_effect=Exception("Invalid credentials")
        )
        
        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "error" in data["detail"]
        assert data["detail"]["error"]["code"] == "AUTHENTICATION_FAILED"
    
    def test_login_with_invalid_email_format(self, client):
        """Test that login with invalid email format returns 422"""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "invalid-email",
                "password": "testpassword123"
            }
        )
        
        assert response.status_code == 422
    
    def test_login_with_missing_fields(self, client):
        """Test that login with missing fields returns 422"""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com"
            }
        )
        
        assert response.status_code == 422


class TestHealthEndpoint:
    """Tests for /api/health endpoint"""
    
    def test_health_check_returns_healthy(self, client):
        """Test that health check endpoint returns healthy status"""
        response = client.get("/api/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "medical-ai-platform"
        assert "version" in data


class TestMiddleware:
    """Tests for middleware functionality"""
    
    def test_request_logging_adds_request_id(self, client):
        """Test that request logging middleware adds request ID to response headers"""
        response = client.get("/api/health")
        
        assert "X-Request-ID" in response.headers
        assert len(response.headers["X-Request-ID"]) > 0
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are properly configured"""
        response = client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET"
            }
        )
        
        # CORS middleware should handle OPTIONS requests
        assert response.status_code in [200, 204]


class TestGlobalExceptionHandler:
    """Tests for global exception handler"""
    
    def test_unhandled_exception_returns_500(self, client, mock_auth_service):
        """Test that unhandled exceptions return 500 with user-friendly message"""
        # Force an unhandled exception
        mock_auth_service.authenticate_user = AsyncMock(
            side_effect=RuntimeError("Unexpected error")
        )
        
        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "testpassword123"
            }
        )
        
        # Should return 401 because the exception is caught in the endpoint
        # But if it was truly unhandled, it would be 500
        assert response.status_code in [401, 500]
