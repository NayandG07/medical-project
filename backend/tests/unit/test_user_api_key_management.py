"""
Unit tests for user API key management
Requirements: 27.1, 27.3, 27.5
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from services.auth import AuthService


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client"""
    return MagicMock()


@pytest.fixture
def auth_service(mock_supabase):
    """Create an AuthService instance with mock Supabase client"""
    return AuthService(supabase_client=mock_supabase)


class TestSetUserApiKey:
    """Tests for set_user_api_key function"""
    
    @pytest.mark.asyncio
    async def test_set_valid_api_key_encrypts_and_stores(self, auth_service, mock_supabase):
        """
        Test that setting a valid API key encrypts it and stores it in the database
        Requirement 27.1: Store user-supplied keys encrypted
        Requirement 27.3: Validate keys before accepting
        """
        user_id = "test-user-123"
        api_key = "sk-test-api-key-1234567890"
        
        # Mock table update
        mock_table = MagicMock()
        mock_update = MagicMock()
        mock_eq = MagicMock()
        mock_eq.execute.return_value = MagicMock()
        mock_update.eq.return_value = mock_eq
        mock_table.update.return_value = mock_update
        mock_supabase.table.return_value = mock_table
        
        # Mock encryption
        with patch('services.auth.encrypt_key') as mock_encrypt:
            mock_encrypt.return_value = "encrypted_key_data"
            
            # Set the API key
            result = await auth_service.set_user_api_key(user_id, api_key)
            
            # Verify encryption was called
            mock_encrypt.assert_called_once_with(api_key)
            
            # Verify database update was called with encrypted key
            mock_table.update.assert_called_once_with({
                "personal_api_key": "encrypted_key_data"
            })
            mock_update.eq.assert_called_once_with("id", user_id)
            
            # Verify success response
            assert result["success"] is True
            assert "successfully" in result["message"].lower()
    
    @pytest.mark.asyncio
    async def test_set_empty_api_key_raises_exception(self, auth_service):
        """
        Test that setting an empty API key raises an exception
        Requirement 27.3: Validate keys before accepting
        """
        user_id = "test-user-123"
        
        # Test empty string
        with pytest.raises(Exception) as exc_info:
            await auth_service.set_user_api_key(user_id, "")
        assert "empty" in str(exc_info.value).lower()
        
        # Test whitespace only
        with pytest.raises(Exception) as exc_info:
            await auth_service.set_user_api_key(user_id, "   ")
        assert "empty" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_set_short_api_key_raises_exception(self, auth_service):
        """
        Test that setting a too-short API key raises an exception
        Requirement 27.3: Validate keys before accepting
        """
        user_id = "test-user-123"
        short_key = "short"
        
        with pytest.raises(Exception) as exc_info:
            await auth_service.set_user_api_key(user_id, short_key)
        assert "invalid" in str(exc_info.value).lower() or "short" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_set_api_key_database_error_raises_exception(self, auth_service, mock_supabase):
        """
        Test that database errors are properly handled
        """
        user_id = "test-user-123"
        api_key = "sk-test-api-key-1234567890"
        
        # Mock table update to raise an exception
        mock_table = MagicMock()
        mock_update = MagicMock()
        mock_eq = MagicMock()
        mock_eq.execute.side_effect = Exception("Database error")
        mock_update.eq.return_value = mock_eq
        mock_table.update.return_value = mock_update
        mock_supabase.table.return_value = mock_table
        
        # Mock encryption
        with patch('services.auth.encrypt_key') as mock_encrypt:
            mock_encrypt.return_value = "encrypted_key_data"
            
            # Try to set the API key
            with pytest.raises(Exception) as exc_info:
                await auth_service.set_user_api_key(user_id, api_key)
            
            assert "failed to set user api key" in str(exc_info.value).lower()


class TestGetUserApiKey:
    """Tests for get_user_api_key function"""
    
    @pytest.mark.asyncio
    async def test_get_existing_api_key_decrypts_and_returns(self, auth_service, mock_supabase):
        """
        Test that getting an existing API key decrypts and returns it
        Requirement 27.1: Retrieve and decrypt user-supplied keys
        """
        user_id = "test-user-123"
        encrypted_key = "encrypted_key_data"
        decrypted_key = "sk-test-api-key-1234567890"
        
        # Mock table select
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{"personal_api_key": encrypted_key}]
        mock_eq.execute.return_value = mock_response
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        mock_supabase.table.return_value = mock_table
        
        # Mock decryption
        with patch('services.auth.decrypt_key') as mock_decrypt:
            mock_decrypt.return_value = decrypted_key
            
            # Get the API key
            result = await auth_service.get_user_api_key(user_id)
            
            # Verify decryption was called
            mock_decrypt.assert_called_once_with(encrypted_key)
            
            # Verify correct key was returned
            assert result == decrypted_key
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_api_key_returns_none(self, auth_service, mock_supabase):
        """
        Test that getting a non-existent API key returns None
        Requirement 27.5: Handle missing keys gracefully
        """
        user_id = "test-user-123"
        
        # Mock table select with no personal_api_key
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{"personal_api_key": None}]
        mock_eq.execute.return_value = mock_response
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        mock_supabase.table.return_value = mock_table
        
        # Get the API key
        result = await auth_service.get_user_api_key(user_id)
        
        # Verify None was returned
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_api_key_user_not_found_raises_exception(self, auth_service, mock_supabase):
        """
        Test that getting an API key for a non-existent user raises an exception
        """
        user_id = "nonexistent-user"
        
        # Mock table select with no data
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_response = MagicMock()
        mock_response.data = []
        mock_eq.execute.return_value = mock_response
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        mock_supabase.table.return_value = mock_table
        
        # Try to get the API key
        with pytest.raises(Exception) as exc_info:
            await auth_service.get_user_api_key(user_id)
        
        assert "user not found" in str(exc_info.value).lower()


class TestRemoveUserApiKey:
    """Tests for remove_user_api_key function"""
    
    @pytest.mark.asyncio
    async def test_remove_api_key_sets_to_none(self, auth_service, mock_supabase):
        """
        Test that removing an API key sets it to None in the database
        Requirement 27.5: Allow users to remove their personal keys
        """
        user_id = "test-user-123"
        
        # Mock table update
        mock_table = MagicMock()
        mock_update = MagicMock()
        mock_eq = MagicMock()
        mock_eq.execute.return_value = MagicMock()
        mock_update.eq.return_value = mock_eq
        mock_table.update.return_value = mock_update
        mock_supabase.table.return_value = mock_table
        
        # Remove the API key
        result = await auth_service.remove_user_api_key(user_id)
        
        # Verify database update was called with None
        mock_table.update.assert_called_once_with({
            "personal_api_key": None
        })
        mock_update.eq.assert_called_once_with("id", user_id)
        
        # Verify success response
        assert result["success"] is True
        assert "removed" in result["message"].lower()
    
    @pytest.mark.asyncio
    async def test_remove_api_key_database_error_raises_exception(self, auth_service, mock_supabase):
        """
        Test that database errors during removal are properly handled
        """
        user_id = "test-user-123"
        
        # Mock table update to raise an exception
        mock_table = MagicMock()
        mock_update = MagicMock()
        mock_eq = MagicMock()
        mock_eq.execute.side_effect = Exception("Database error")
        mock_update.eq.return_value = mock_eq
        mock_table.update.return_value = mock_update
        mock_supabase.table.return_value = mock_table
        
        # Try to remove the API key
        with pytest.raises(Exception) as exc_info:
            await auth_service.remove_user_api_key(user_id)
        
        assert "failed to remove user api key" in str(exc_info.value).lower()


class TestUserApiKeyRoundTrip:
    """Integration tests for user API key management"""
    
    @pytest.mark.asyncio
    async def test_set_get_remove_api_key_round_trip(self, auth_service, mock_supabase):
        """
        Test the complete lifecycle: set, get, remove
        Requirements: 27.1, 27.5
        """
        user_id = "test-user-123"
        api_key = "sk-test-api-key-1234567890"
        encrypted_key = "encrypted_key_data"
        
        # Mock for set operation
        mock_table_set = MagicMock()
        mock_update = MagicMock()
        mock_eq_set = MagicMock()
        mock_eq_set.execute.return_value = MagicMock()
        mock_update.eq.return_value = mock_eq_set
        mock_table_set.update.return_value = mock_update
        
        # Mock for get operation
        mock_table_get = MagicMock()
        mock_select = MagicMock()
        mock_eq_get = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{"personal_api_key": encrypted_key}]
        mock_eq_get.execute.return_value = mock_response
        mock_select.eq.return_value = mock_eq_get
        mock_table_get.select.return_value = mock_select
        
        # Mock for remove operation
        mock_table_remove = MagicMock()
        mock_update_remove = MagicMock()
        mock_eq_remove = MagicMock()
        mock_eq_remove.execute.return_value = MagicMock()
        mock_update_remove.eq.return_value = mock_eq_remove
        mock_table_remove.update.return_value = mock_update_remove
        
        # Set up table mock to return different mocks for different operations
        call_count = [0]
        def mock_table_side_effect(table_name):
            call_count[0] += 1
            if call_count[0] == 1:  # First call (set)
                return mock_table_set
            elif call_count[0] == 2:  # Second call (get)
                return mock_table_get
            else:  # Third call (remove)
                return mock_table_remove
        
        mock_supabase.table.side_effect = mock_table_side_effect
        
        # Mock encryption/decryption
        with patch('services.auth.encrypt_key') as mock_encrypt, \
             patch('services.auth.decrypt_key') as mock_decrypt:
            mock_encrypt.return_value = encrypted_key
            mock_decrypt.return_value = api_key
            
            # 1. Set the API key
            set_result = await auth_service.set_user_api_key(user_id, api_key)
            assert set_result["success"] is True
            
            # 2. Get the API key
            get_result = await auth_service.get_user_api_key(user_id)
            assert get_result == api_key
            
            # 3. Remove the API key
            remove_result = await auth_service.remove_user_api_key(user_id)
            assert remove_result["success"] is True
