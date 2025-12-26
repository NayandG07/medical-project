"""
Unit tests for Chat API Endpoints
Tests specific examples and edge cases for chat endpoints
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from main import app
import uuid


client = TestClient(app)


class TestChatSessionEndpoints:
    """Tests for chat session endpoints"""
    
    @patch('main.get_chat_service')
    @patch('main.get_current_user_id')
    def test_get_sessions_returns_user_sessions(self, mock_get_user_id, mock_get_chat_service):
        """Test GET /api/chat/sessions returns user's sessions"""
        # Arrange
        user_id = str(uuid.uuid4())
        mock_get_user_id.return_value = AsyncMock(return_value=user_id)()
        
        mock_chat_service = MagicMock()
        mock_chat_service.get_user_sessions = AsyncMock(return_value=[
            {
                "id": "session1",
                "user_id": user_id,
                "title": "Test Session",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
        ])
        mock_get_chat_service.return_value = mock_chat_service
        
        # Act
        response = client.get(
            "/api/chat/sessions",
            headers={"Authorization": f"Bearer {user_id}"}
        )
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "session1"
    
    @patch('main.get_chat_service')
    @patch('main.get_current_user_id')
    def test_create_session_returns_new_session(self, mock_get_user_id, mock_get_chat_service):
        """Test POST /api/chat/sessions creates a new session"""
        # Arrange
        user_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        mock_get_user_id.return_value = AsyncMock(return_value=user_id)()
        
        mock_chat_service = MagicMock()
        mock_chat_service.create_session = AsyncMock(return_value={
            "id": session_id,
            "user_id": user_id,
            "title": "New Session",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        })
        mock_get_chat_service.return_value = mock_chat_service
        
        # Act
        response = client.post(
            "/api/chat/sessions",
            json={"title": "New Session"},
            headers={"Authorization": f"Bearer {user_id}"}
        )
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == session_id
        assert data["title"] == "New Session"
    
    def test_get_sessions_without_auth_returns_401(self):
        """Test GET /api/chat/sessions without auth returns 401"""
        # Act
        response = client.get("/api/chat/sessions")
        
        # Assert
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert data["detail"]["error"]["code"] == "MISSING_AUTHORIZATION"


class TestChatMessageEndpoints:
    """Tests for chat message endpoints"""
    
    @patch('main.get_chat_service')
    @patch('main.get_current_user_id')
    def test_get_messages_returns_session_messages(self, mock_get_user_id, mock_get_chat_service):
        """Test GET /api/chat/sessions/{session_id}/messages returns messages"""
        # Arrange
        user_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        mock_get_user_id.return_value = AsyncMock(return_value=user_id)()
        
        mock_chat_service = MagicMock()
        mock_chat_service.get_chat_history = AsyncMock(return_value=[
            {
                "id": "msg1",
                "session_id": session_id,
                "role": "user",
                "content": "Hello",
                "tokens_used": None,
                "citations": None,
                "created_at": "2024-01-01T00:00:00Z"
            }
        ])
        mock_get_chat_service.return_value = mock_chat_service
        
        # Act
        response = client.get(
            f"/api/chat/sessions/{session_id}/messages",
            headers={"Authorization": f"Bearer {user_id}"}
        )
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["content"] == "Hello"
    
    @patch('main.get_chat_service')
    @patch('main.get_current_user_id')
    def test_send_message_stores_message(self, mock_get_user_id, mock_get_chat_service):
        """Test POST /api/chat/sessions/{session_id}/messages stores message"""
        # Arrange
        user_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        message_id = str(uuid.uuid4())
        mock_get_user_id.return_value = AsyncMock(return_value=user_id)()
        
        mock_chat_service = MagicMock()
        mock_chat_service.send_message = AsyncMock(return_value={
            "id": message_id,
            "session_id": session_id,
            "role": "user",
            "content": "Test message",
            "tokens_used": None,
            "citations": None,
            "created_at": "2024-01-01T00:00:00Z"
        })
        mock_get_chat_service.return_value = mock_chat_service
        
        # Act
        response = client.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"message": "Test message"},
            headers={"Authorization": f"Bearer {user_id}"}
        )
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "Test message"
        assert data["role"] == "user"
    
    @patch('main.get_chat_service')
    @patch('main.get_current_user_id')
    def test_send_message_to_invalid_session_returns_404(self, mock_get_user_id, mock_get_chat_service):
        """Test sending message to non-existent session returns 404"""
        # Arrange
        user_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        mock_get_user_id.return_value = AsyncMock(return_value=user_id)()
        
        mock_chat_service = MagicMock()
        mock_chat_service.send_message = AsyncMock(
            side_effect=Exception("Session not found or does not belong to user")
        )
        mock_get_chat_service.return_value = mock_chat_service
        
        # Act
        response = client.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"message": "Test message"},
            headers={"Authorization": f"Bearer {user_id}"}
        )
        
        # Assert
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert data["detail"]["error"]["code"] == "SESSION_NOT_FOUND"
    
    def test_send_message_without_auth_returns_401(self):
        """Test POST /api/chat/sessions/{session_id}/messages without auth returns 401"""
        # Arrange
        session_id = str(uuid.uuid4())
        
        # Act
        response = client.post(
            f"/api/chat/sessions/{session_id}/messages",
            json={"message": "Test message"}
        )
        
        # Assert
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert data["detail"]["error"]["code"] == "MISSING_AUTHORIZATION"
    
    @patch('main.get_chat_service')
    @patch('main.get_current_user_id')
    def test_get_messages_from_invalid_session_returns_404(self, mock_get_user_id, mock_get_chat_service):
        """Test getting messages from non-existent session returns 404"""
        # Arrange
        user_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        mock_get_user_id.return_value = AsyncMock(return_value=user_id)()
        
        mock_chat_service = MagicMock()
        mock_chat_service.get_chat_history = AsyncMock(
            side_effect=Exception("Session not found or does not belong to user")
        )
        mock_get_chat_service.return_value = mock_chat_service
        
        # Act
        response = client.get(
            f"/api/chat/sessions/{session_id}/messages",
            headers={"Authorization": f"Bearer {user_id}"}
        )
        
        # Assert
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert data["detail"]["error"]["code"] == "SESSION_NOT_FOUND"
