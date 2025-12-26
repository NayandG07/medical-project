"""
Pytest configuration and fixtures for the Medical AI Platform tests
"""
import pytest
import os
from unittest.mock import MagicMock
from supabase import create_client, Client


@pytest.fixture
def mock_supabase_client():
    """
    Mock Supabase client for testing without actual database connection
    """
    mock_client = MagicMock(spec=Client)
    return mock_client


@pytest.fixture
def test_env_vars():
    """
    Fixture to provide test environment variables
    """
    return {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_KEY': 'test-anon-key',
        'SUPABASE_SERVICE_KEY': 'test-service-key',
        'SUPER_ADMIN_EMAIL': 'admin@test.com',
        'FRONTEND_URL': 'http://localhost:3000',
        'ENCRYPTION_KEY': 'test-encryption-key-32-bytes-long!',
    }


@pytest.fixture
def sample_user_data():
    """
    Sample user data for testing
    """
    return {
        'email': 'test@example.com',
        'name': 'Test User',
        'plan': 'free',
        'role': None,
        'disabled': False
    }


@pytest.fixture
def sample_admin_data():
    """
    Sample admin data for testing
    """
    return {
        'email': 'admin@example.com',
        'role': 'admin'
    }


@pytest.fixture
def sample_api_key_data():
    """
    Sample API key data for testing
    """
    return {
        'provider': 'gemini',
        'feature': 'chat',
        'key_value': 'encrypted_key_value',
        'priority': 10,
        'status': 'active'
    }


@pytest.fixture
def sample_usage_data():
    """
    Sample usage counter data for testing
    """
    return {
        'tokens_used': 100,
        'requests_count': 5,
        'pdf_uploads': 0,
        'mcqs_generated': 2,
        'images_used': 0,
        'flashcards_generated': 3
    }
