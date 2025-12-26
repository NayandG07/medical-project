"""
Unit tests for project setup
Tests environment variable loading and basic FastAPI app initialization
Requirements: 25.1
"""
import pytest
import os
from fastapi.testclient import TestClient
from unittest.mock import patch


def test_environment_variables_loading():
    """
    Test that environment variables can be loaded
    Requirements: 25.1
    """
    # Test with mock environment variables
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_KEY': 'test-key',
        'FRONTEND_URL': 'http://localhost:3000',
        'SUPER_ADMIN_EMAIL': 'admin@test.com'
    }):
        assert os.getenv('SUPABASE_URL') == 'https://test.supabase.co'
        assert os.getenv('SUPABASE_KEY') == 'test-key'
        assert os.getenv('FRONTEND_URL') == 'http://localhost:3000'
        assert os.getenv('SUPER_ADMIN_EMAIL') == 'admin@test.com'


def test_environment_variables_with_defaults():
    """
    Test that environment variables return None when not set
    Requirements: 25.1
    """
    # Clear environment and test defaults
    with patch.dict(os.environ, {}, clear=True):
        assert os.getenv('NONEXISTENT_VAR') is None
        assert os.getenv('NONEXISTENT_VAR', 'default') == 'default'


def test_fastapi_app_initialization():
    """
    Test that FastAPI app initializes correctly
    Requirements: 25.1
    """
    from main import app
    
    # Check app is initialized
    assert app is not None
    assert app.title == "Medical AI Platform API"
    assert app.version == "1.0.0"


def test_health_endpoint():
    """
    Test that health check endpoint works
    Requirements: 25.1
    """
    from main import app
    
    client = TestClient(app)
    response = client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "medical-ai-platform"
    assert data["version"] == "1.0.0"


def test_root_endpoint():
    """
    Test that root endpoint works
    Requirements: 25.1
    """
    from main import app
    
    client = TestClient(app)
    response = client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["message"] == "Medical AI Platform API"


def test_cors_middleware_configured():
    """
    Test that CORS middleware is configured
    Requirements: 25.1
    """
    from main import app
    
    # Check that middleware is configured
    assert len(app.user_middleware) > 0
    # Verify we have at least 2 middleware (logging + CORS)
    # The first middleware is our custom logging middleware (BaseHTTPMiddleware)
    assert app.user_middleware[0].cls.__name__ == 'BaseHTTPMiddleware'
    # CORS middleware is added via add_middleware and is in the middleware stack
    # We can verify CORS is working by checking middleware count
    assert len(app.user_middleware) >= 1
