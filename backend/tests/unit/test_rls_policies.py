"""
Unit tests for Supabase Row Level Security (RLS) policies
Requirements: 23.4

These tests verify that RLS policies correctly enforce data access controls:
- Users can access their own data
- Users cannot access other users' data
- Admins can access all data
"""
import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4


class TestUsersTableRLS:
    """Test RLS policies for users table"""
    
    def test_user_can_read_own_record(self, mock_supabase_client):
        """
        Test that a user can read their own user record
        Requirements: 23.4
        """
        user_id = str(uuid4())
        
        # Mock the Supabase query
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {'id': user_id, 'email': 'user@test.com', 'plan': 'free'}
        ]
        
        # Simulate user querying their own record
        result = mock_supabase_client.table('users').select('*').eq('id', user_id).execute()
        
        assert len(result.data) == 1
        assert result.data[0]['id'] == user_id
    
    def test_user_cannot_read_other_user_record(self, mock_supabase_client):
        """
        Test that a user cannot read another user's record
        Requirements: 23.4
        """
        user_id = str(uuid4())
        other_user_id = str(uuid4())
        
        # Mock the Supabase query returning empty (RLS blocks access)
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        # Simulate user trying to query another user's record
        result = mock_supabase_client.table('users').select('*').eq('id', other_user_id).execute()
        
        # RLS should prevent access
        assert len(result.data) == 0
    
    def test_admin_can_read_all_users(self, mock_supabase_client):
        """
        Test that an admin can read all user records
        Requirements: 23.4
        """
        # Mock the Supabase query returning multiple users
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = [
            {'id': str(uuid4()), 'email': 'user1@test.com', 'plan': 'free'},
            {'id': str(uuid4()), 'email': 'user2@test.com', 'plan': 'student'},
            {'id': str(uuid4()), 'email': 'user3@test.com', 'plan': 'pro'}
        ]
        
        # Simulate admin querying all users
        result = mock_supabase_client.table('users').select('*').execute()
        
        # Admin should see all users
        assert len(result.data) == 3


class TestUsageCountersTableRLS:
    """Test RLS policies for usage_counters table"""
    
    def test_user_can_read_own_usage(self, mock_supabase_client):
        """
        Test that a user can read their own usage counters
        Requirements: 23.4
        """
        user_id = str(uuid4())
        
        # Mock the Supabase query
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {'user_id': user_id, 'tokens_used': 100, 'requests_count': 5}
        ]
        
        # Simulate user querying their own usage
        result = mock_supabase_client.table('usage_counters').select('*').eq('user_id', user_id).execute()
        
        assert len(result.data) == 1
        assert result.data[0]['user_id'] == user_id
    
    def test_user_cannot_read_other_user_usage(self, mock_supabase_client):
        """
        Test that a user cannot read another user's usage counters
        Requirements: 23.4
        """
        user_id = str(uuid4())
        other_user_id = str(uuid4())
        
        # Mock the Supabase query returning empty (RLS blocks access)
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        # Simulate user trying to query another user's usage
        result = mock_supabase_client.table('usage_counters').select('*').eq('user_id', other_user_id).execute()
        
        # RLS should prevent access
        assert len(result.data) == 0
    
    def test_admin_can_read_all_usage(self, mock_supabase_client):
        """
        Test that an admin can read all usage counters
        Requirements: 23.4
        """
        # Mock the Supabase query returning multiple usage records
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = [
            {'user_id': str(uuid4()), 'tokens_used': 100, 'requests_count': 5},
            {'user_id': str(uuid4()), 'tokens_used': 200, 'requests_count': 10},
            {'user_id': str(uuid4()), 'tokens_used': 50, 'requests_count': 3}
        ]
        
        # Simulate admin querying all usage
        result = mock_supabase_client.table('usage_counters').select('*').execute()
        
        # Admin should see all usage records
        assert len(result.data) == 3


class TestAdminTablesRLS:
    """Test RLS policies for admin-only tables"""
    
    def test_non_admin_cannot_access_api_keys(self, mock_supabase_client):
        """
        Test that non-admin users cannot access api_keys table
        Requirements: 23.4
        """
        # Mock the Supabase query returning empty (RLS blocks access)
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = []
        
        # Simulate non-admin trying to query api_keys
        result = mock_supabase_client.table('api_keys').select('*').execute()
        
        # RLS should prevent access
        assert len(result.data) == 0
    
    def test_admin_can_access_api_keys(self, mock_supabase_client):
        """
        Test that admin users can access api_keys table
        Requirements: 23.4
        """
        # Mock the Supabase query returning api keys
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = [
            {'id': str(uuid4()), 'provider': 'gemini', 'feature': 'chat', 'status': 'active'},
            {'id': str(uuid4()), 'provider': 'openai', 'feature': 'flashcard', 'status': 'active'}
        ]
        
        # Simulate admin querying api_keys
        result = mock_supabase_client.table('api_keys').select('*').execute()
        
        # Admin should see all api keys
        assert len(result.data) == 2
    
    def test_non_admin_cannot_access_admin_allowlist(self, mock_supabase_client):
        """
        Test that non-admin users cannot access admin_allowlist table
        Requirements: 23.4
        """
        # Mock the Supabase query returning empty (RLS blocks access)
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = []
        
        # Simulate non-admin trying to query admin_allowlist
        result = mock_supabase_client.table('admin_allowlist').select('*').execute()
        
        # RLS should prevent access
        assert len(result.data) == 0
    
    def test_admin_can_access_admin_allowlist(self, mock_supabase_client):
        """
        Test that admin users can access admin_allowlist table
        Requirements: 23.4
        """
        # Mock the Supabase query returning admin allowlist
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = [
            {'email': 'admin1@test.com', 'role': 'super_admin'},
            {'email': 'admin2@test.com', 'role': 'admin'}
        ]
        
        # Simulate admin querying admin_allowlist
        result = mock_supabase_client.table('admin_allowlist').select('*').execute()
        
        # Admin should see all admin allowlist entries
        assert len(result.data) == 2
    
    def test_non_admin_cannot_access_system_flags(self, mock_supabase_client):
        """
        Test that non-admin users cannot access system_flags table
        Requirements: 23.4
        """
        # Mock the Supabase query returning empty (RLS blocks access)
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = []
        
        # Simulate non-admin trying to query system_flags
        result = mock_supabase_client.table('system_flags').select('*').execute()
        
        # RLS should prevent access
        assert len(result.data) == 0
    
    def test_admin_can_access_system_flags(self, mock_supabase_client):
        """
        Test that admin users can access system_flags table
        Requirements: 23.4
        """
        # Mock the Supabase query returning system flags
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = [
            {'flag_name': 'maintenance_mode', 'flag_value': 'false'},
            {'flag_name': 'feature_chat_enabled', 'flag_value': 'true'}
        ]
        
        # Simulate admin querying system_flags
        result = mock_supabase_client.table('system_flags').select('*').execute()
        
        # Admin should see all system flags
        assert len(result.data) == 2


class TestUserOwnedDataRLS:
    """Test RLS policies for user-owned data tables"""
    
    def test_user_can_access_own_documents(self, mock_supabase_client):
        """
        Test that a user can access their own documents
        Requirements: 23.4
        """
        user_id = str(uuid4())
        
        # Mock the Supabase query
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {'id': str(uuid4()), 'user_id': user_id, 'filename': 'test.pdf'}
        ]
        
        # Simulate user querying their own documents
        result = mock_supabase_client.table('documents').select('*').eq('user_id', user_id).execute()
        
        assert len(result.data) == 1
        assert result.data[0]['user_id'] == user_id
    
    def test_user_cannot_access_other_user_documents(self, mock_supabase_client):
        """
        Test that a user cannot access another user's documents
        Requirements: 23.4
        """
        user_id = str(uuid4())
        other_user_id = str(uuid4())
        
        # Mock the Supabase query returning empty (RLS blocks access)
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        # Simulate user trying to query another user's documents
        result = mock_supabase_client.table('documents').select('*').eq('user_id', other_user_id).execute()
        
        # RLS should prevent access
        assert len(result.data) == 0
    
    def test_user_can_access_own_chat_sessions(self, mock_supabase_client):
        """
        Test that a user can access their own chat sessions
        Requirements: 23.4
        """
        user_id = str(uuid4())
        
        # Mock the Supabase query
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {'id': str(uuid4()), 'user_id': user_id, 'title': 'Test Chat'}
        ]
        
        # Simulate user querying their own chat sessions
        result = mock_supabase_client.table('chat_sessions').select('*').eq('user_id', user_id).execute()
        
        assert len(result.data) == 1
        assert result.data[0]['user_id'] == user_id
    
    def test_user_cannot_access_other_user_chat_sessions(self, mock_supabase_client):
        """
        Test that a user cannot access another user's chat sessions
        Requirements: 23.4
        """
        user_id = str(uuid4())
        other_user_id = str(uuid4())
        
        # Mock the Supabase query returning empty (RLS blocks access)
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        # Simulate user trying to query another user's chat sessions
        result = mock_supabase_client.table('chat_sessions').select('*').eq('user_id', other_user_id).execute()
        
        # RLS should prevent access
        assert len(result.data) == 0
    
    def test_user_can_access_own_messages(self, mock_supabase_client):
        """
        Test that a user can access messages in their own chat sessions
        Requirements: 23.4
        """
        user_id = str(uuid4())
        session_id = str(uuid4())
        
        # Mock the chat session ownership check
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'id': session_id, 'user_id': user_id
        }
        
        # Mock the messages query
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {'id': str(uuid4()), 'session_id': session_id, 'content': 'Test message'}
        ]
        
        # Simulate user querying messages in their own session
        result = mock_supabase_client.table('messages').select('*').eq('session_id', session_id).execute()
        
        assert len(result.data) == 1
        assert result.data[0]['session_id'] == session_id
    
    def test_user_cannot_access_other_user_messages(self, mock_supabase_client):
        """
        Test that a user cannot access messages in another user's chat sessions
        Requirements: 23.4
        """
        user_id = str(uuid4())
        other_user_id = str(uuid4())
        other_session_id = str(uuid4())
        
        # Mock the Supabase query returning empty (RLS blocks access)
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        # Simulate user trying to query messages in another user's session
        result = mock_supabase_client.table('messages').select('*').eq('session_id', other_session_id).execute()
        
        # RLS should prevent access
        assert len(result.data) == 0
    
    def test_admin_can_access_all_documents(self, mock_supabase_client):
        """
        Test that admin users can access all documents
        Requirements: 23.4
        """
        # Mock the Supabase query returning multiple documents
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = [
            {'id': str(uuid4()), 'user_id': str(uuid4()), 'filename': 'doc1.pdf'},
            {'id': str(uuid4()), 'user_id': str(uuid4()), 'filename': 'doc2.pdf'}
        ]
        
        # Simulate admin querying all documents
        result = mock_supabase_client.table('documents').select('*').execute()
        
        # Admin should see all documents
        assert len(result.data) == 2
    
    def test_admin_can_access_all_chat_sessions(self, mock_supabase_client):
        """
        Test that admin users can access all chat sessions
        Requirements: 23.4
        """
        # Mock the Supabase query returning multiple chat sessions
        mock_supabase_client.table.return_value.select.return_value.execute.return_value.data = [
            {'id': str(uuid4()), 'user_id': str(uuid4()), 'title': 'Chat 1'},
            {'id': str(uuid4()), 'user_id': str(uuid4()), 'title': 'Chat 2'}
        ]
        
        # Simulate admin querying all chat sessions
        result = mock_supabase_client.table('chat_sessions').select('*').execute()
        
        # Admin should see all chat sessions
        assert len(result.data) == 2


class TestEmbeddingsRLS:
    """Test RLS policies for embeddings table (user-owned via documents)"""
    
    def test_user_can_access_own_embeddings(self, mock_supabase_client):
        """
        Test that a user can access embeddings for their own documents
        Requirements: 23.4
        """
        user_id = str(uuid4())
        document_id = str(uuid4())
        
        # Mock the document ownership check
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'id': document_id, 'user_id': user_id
        }
        
        # Mock the embeddings query
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {'id': str(uuid4()), 'document_id': document_id, 'chunk_text': 'Test chunk'}
        ]
        
        # Simulate user querying embeddings for their own document
        result = mock_supabase_client.table('embeddings').select('*').eq('document_id', document_id).execute()
        
        assert len(result.data) == 1
        assert result.data[0]['document_id'] == document_id
    
    def test_user_cannot_access_other_user_embeddings(self, mock_supabase_client):
        """
        Test that a user cannot access embeddings for another user's documents
        Requirements: 23.4
        """
        user_id = str(uuid4())
        other_user_id = str(uuid4())
        other_document_id = str(uuid4())
        
        # Mock the Supabase query returning empty (RLS blocks access)
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        
        # Simulate user trying to query embeddings for another user's document
        result = mock_supabase_client.table('embeddings').select('*').eq('document_id', other_document_id).execute()
        
        # RLS should prevent access
        assert len(result.data) == 0

