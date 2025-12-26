"""
Property-Based Tests for Chat Service
Tests universal properties related to chat functionality
Feature: medical-ai-platform
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import MagicMock, AsyncMock
from services.chat import ChatService
import uuid


# Custom strategies for generating test data
def valid_message_content():
    """Generate valid message content (non-empty strings)"""
    return st.text(min_size=1, max_size=1000)


def valid_role():
    """Generate valid message roles"""
    return st.sampled_from(["user", "assistant", "system"])


# Feature: medical-ai-platform, Property 8: Messages persist to database
@given(
    message_content=valid_message_content(),
    role=valid_role()
)
@settings(max_examples=100)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_message_persistence_property(message_content, role):
    """
    Property 8: For any message sent in a chat session, 
    the message should appear in the messages table with correct 
    session_id, role, and content.
    
    Validates: Requirements 3.4
    """
    # Arrange: Create mock Supabase client
    mock_supabase = MagicMock()
    
    # Generate test IDs
    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    message_id = str(uuid.uuid4())
    
    # Mock session verification (session exists and belongs to user)
    mock_session_response = MagicMock()
    mock_session_response.data = [{"id": session_id}]
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_session_response
    
    # Mock message insertion
    mock_message_response = MagicMock()
    mock_message_response.data = [{
        "id": message_id,
        "session_id": session_id,
        "role": role,
        "content": message_content,
        "tokens_used": None,
        "citations": None,
        "created_at": "2024-01-01T00:00:00Z"
    }]
    
    # Set up the mock chain for message insertion
    mock_insert = MagicMock()
    mock_insert.execute.return_value = mock_message_response
    mock_supabase.table.return_value.insert.return_value = mock_insert
    
    # Mock session update
    mock_update_response = MagicMock()
    mock_update_response.data = [{"id": session_id}]
    mock_update = MagicMock()
    mock_update.execute.return_value = mock_update_response
    mock_supabase.table.return_value.update.return_value.eq.return_value = mock_update
    
    # Create chat service with mock client
    chat_service = ChatService(supabase_client=mock_supabase)
    
    # Act: Send message
    result = await chat_service.send_message(user_id, session_id, message_content, role)
    
    # Assert: Message was persisted with correct data
    assert result is not None
    assert result["session_id"] == session_id
    assert result["role"] == role
    assert result["content"] == message_content
    assert "created_at" in result
    
    # Verify the message was inserted into the database
    mock_supabase.table.assert_any_call("messages")
    mock_insert.execute.assert_called_once()



# Feature: medical-ai-platform, Property 6: Messages are routed to backend
@given(
    message_content=valid_message_content(),
    role=valid_role()
)
@settings(max_examples=100)
@pytest.mark.asyncio
@pytest.mark.property_test
async def test_message_routing_property(message_content, role):
    """
    Property 6: For any user message sent from the frontend, 
    the message should reach the backend API gateway.
    
    Validates: Requirements 3.2
    """
    # Arrange: Create mock Supabase client
    mock_supabase = MagicMock()
    
    # Generate test IDs
    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    message_id = str(uuid.uuid4())
    
    # Mock session verification
    mock_session_response = MagicMock()
    mock_session_response.data = [{"id": session_id}]
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_session_response
    
    # Mock message insertion
    mock_message_response = MagicMock()
    mock_message_response.data = [{
        "id": message_id,
        "session_id": session_id,
        "role": role,
        "content": message_content,
        "tokens_used": None,
        "citations": None,
        "created_at": "2024-01-01T00:00:00Z"
    }]
    
    mock_insert = MagicMock()
    mock_insert.execute.return_value = mock_message_response
    mock_supabase.table.return_value.insert.return_value = mock_insert
    
    # Mock session update
    mock_update_response = MagicMock()
    mock_update_response.data = [{"id": session_id}]
    mock_update = MagicMock()
    mock_update.execute.return_value = mock_update_response
    mock_supabase.table.return_value.update.return_value.eq.return_value = mock_update
    
    # Create chat service with mock client
    chat_service = ChatService(supabase_client=mock_supabase)
    
    # Act: Send message (simulating routing from frontend to backend)
    result = await chat_service.send_message(user_id, session_id, message_content, role)
    
    # Assert: Message reached the backend and was processed
    assert result is not None
    assert result["content"] == message_content
    assert result["role"] == role
    
    # Verify the backend received and processed the message
    mock_insert.execute.assert_called_once()
