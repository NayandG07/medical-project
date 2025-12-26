"""
Unit tests for Chat Service
Tests specific examples and edge cases for chat functionality
"""
import pytest
from unittest.mock import MagicMock, AsyncMock
from services.chat import ChatService, get_chat_service
import uuid


@pytest.mark.asyncio
async def test_create_session_success():
    """Test successful session creation"""
    # Arrange
    mock_supabase = MagicMock()
    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    title = "Test Session"
    
    mock_response = MagicMock()
    mock_response.data = [{
        "id": session_id,
        "user_id": user_id,
        "title": title,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }]
    
    mock_insert = MagicMock()
    mock_insert.execute.return_value = mock_response
    mock_supabase.table.return_value.insert.return_value = mock_insert
    
    chat_service = ChatService(supabase_client=mock_supabase)
    
    # Act
    result = await chat_service.create_session(user_id, title)
    
    # Assert
    assert result["id"] == session_id
    assert result["user_id"] == user_id
    assert result["title"] == title
    mock_supabase.table.assert_called_with("chat_sessions")


@pytest.mark.asyncio
async def test_get_user_sessions_returns_ordered_list():
    """Test getting user sessions returns them ordered by updated_at"""
    # Arrange
    mock_supabase = MagicMock()
    user_id = str(uuid.uuid4())
    
    mock_response = MagicMock()
    mock_response.data = [
        {"id": "session1", "updated_at": "2024-01-02T00:00:00Z"},
        {"id": "session2", "updated_at": "2024-01-01T00:00:00Z"}
    ]
    
    mock_order = MagicMock()
    mock_order.execute.return_value = mock_response
    mock_eq = MagicMock()
    mock_eq.order.return_value = mock_order
    mock_select = MagicMock()
    mock_select.eq.return_value = mock_eq
    mock_supabase.table.return_value.select.return_value = mock_select
    
    chat_service = ChatService(supabase_client=mock_supabase)
    
    # Act
    result = await chat_service.get_user_sessions(user_id)
    
    # Assert
    assert len(result) == 2
    assert result[0]["id"] == "session1"
    mock_eq.order.assert_called_with("updated_at", desc=True)


@pytest.mark.asyncio
async def test_send_message_stores_with_timestamp():
    """Test that sending a message stores it with timestamp"""
    # Arrange
    mock_supabase = MagicMock()
    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    message_id = str(uuid.uuid4())
    message_content = "Test message"
    
    # Mock session verification
    mock_session_response = MagicMock()
    mock_session_response.data = [{"id": session_id}]
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_session_response
    
    # Mock message insertion
    mock_message_response = MagicMock()
    mock_message_response.data = [{
        "id": message_id,
        "session_id": session_id,
        "role": "user",
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
    
    chat_service = ChatService(supabase_client=mock_supabase)
    
    # Act
    result = await chat_service.send_message(user_id, session_id, message_content)
    
    # Assert
    assert result["content"] == message_content
    assert "created_at" in result
    assert result["created_at"] is not None


@pytest.mark.asyncio
async def test_get_chat_history_returns_ordered_messages():
    """Test getting chat history returns messages ordered by created_at"""
    # Arrange
    mock_supabase = MagicMock()
    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    # Mock session verification
    mock_session_response = MagicMock()
    mock_session_response.data = [{"id": session_id}]
    
    # Mock messages retrieval
    mock_messages_response = MagicMock()
    mock_messages_response.data = [
        {"id": "msg1", "content": "First", "created_at": "2024-01-01T00:00:00Z"},
        {"id": "msg2", "content": "Second", "created_at": "2024-01-01T00:01:00Z"}
    ]
    
    # Set up mock chain
    mock_order = MagicMock()
    mock_order.execute.return_value = mock_messages_response
    mock_eq = MagicMock()
    mock_eq.order.return_value = mock_order
    mock_select = MagicMock()
    mock_select.eq.return_value = mock_eq
    
    # Configure table mock to return different responses
    def table_side_effect(table_name):
        mock_table = MagicMock()
        if table_name == "chat_sessions":
            mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_session_response
        elif table_name == "messages":
            mock_table.select.return_value = mock_select
        return mock_table
    
    mock_supabase.table.side_effect = table_side_effect
    
    chat_service = ChatService(supabase_client=mock_supabase)
    
    # Act
    result = await chat_service.get_chat_history(user_id, session_id)
    
    # Assert
    assert len(result) == 2
    assert result[0]["content"] == "First"
    assert result[1]["content"] == "Second"
    mock_eq.order.assert_called_with("created_at", desc=False)


@pytest.mark.asyncio
async def test_send_message_rejects_invalid_session():
    """Test that sending a message to non-existent session fails"""
    # Arrange
    mock_supabase = MagicMock()
    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    # Mock session verification - session not found
    mock_session_response = MagicMock()
    mock_session_response.data = []
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_session_response
    
    chat_service = ChatService(supabase_client=mock_supabase)
    
    # Act & Assert
    with pytest.raises(Exception) as exc_info:
        await chat_service.send_message(user_id, session_id, "Test message")
    
    assert "Session not found" in str(exc_info.value)
