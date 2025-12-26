"""
Medical AI Platform - FastAPI Backend
Main application entry point
Requirements: 20.1, 20.6, 20.7
"""
from fastapi import FastAPI, Request, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import os
import logging
import time
import uuid
from dotenv import load_dotenv
from services.auth import get_auth_service
from services.chat import get_chat_service

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Medical AI Platform API",
    description="Production-grade AI medical education platform",
    version="1.0.0"
)

# Configure CORS for Next.js frontend (Requirement 20.7)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware (Requirement 20.6)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Middleware to log all incoming requests
    Requirement 20.6: Add request logging middleware
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Add request ID to request state
    request.state.request_id = request_id
    
    # Log incoming request
    logger.info(
        f"Request started: {request.method} {request.url.path} "
        f"[Request ID: {request_id}]"
    )
    
    # Process request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    
    # Log completed request
    logger.info(
        f"Request completed: {request.method} {request.url.path} "
        f"[Request ID: {request_id}] "
        f"[Status: {response.status_code}] "
        f"[Duration: {process_time:.3f}s]"
    )
    
    # Add request ID to response headers
    response.headers["X-Request-ID"] = request_id
    
    return response


# Global exception handler (Requirement 20.7)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for all unhandled exceptions
    Requirement 20.7: Add global exception handler
    """
    request_id = getattr(request.state, "request_id", "unknown")
    
    # Log the error
    logger.error(
        f"Unhandled exception: {str(exc)} "
        f"[Request ID: {request_id}] "
        f"[Path: {request.method} {request.url.path}]",
        exc_info=True
    )
    
    # Return user-friendly error response
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "request_id": request_id
            }
        }
    )


# Pydantic models for request/response validation
class RegisterRequest(BaseModel):
    """Request model for user registration"""
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    """Request model for user login"""
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    """Response model for authentication endpoints"""
    user: dict
    session: dict
    plan: str


class CreateSessionRequest(BaseModel):
    """Request model for creating a chat session"""
    title: Optional[str] = None


class SendMessageRequest(BaseModel):
    """Request model for sending a message"""
    message: str
    role: Optional[str] = "user"


class SessionResponse(BaseModel):
    """Response model for chat session"""
    id: str
    user_id: str
    title: Optional[str]
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    """Response model for chat message"""
    id: str
    session_id: str
    role: str
    content: str
    tokens_used: Optional[int]
    citations: Optional[dict]
    created_at: str


# Health check endpoint
@app.get("/api/health")
async def health_check():
    """
    Health check endpoint
    Returns service status and version information
    """
    return {
        "status": "healthy",
        "service": "medical-ai-platform",
        "version": "1.0.0"
    }


# Authentication endpoints
@app.post("/api/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    """
    Register a new user with default "free" plan
    
    Requirements: 1.1, 1.2
    
    Args:
        request: Registration request containing email, password, and name
        
    Returns:
        User data, session information, and assigned plan
        
    Raises:
        HTTPException: If registration fails
    """
    try:
        auth_service = get_auth_service()
        result = await auth_service.register_user(
            email=request.email,
            password=request.password,
            name=request.name
        )
        
        return {
            "user": {
                "id": result["user"].id,
                "email": result["user"].email,
            },
            "session": {
                "access_token": result["session"].access_token if result["session"] else None,
                "refresh_token": result["session"].refresh_token if result["session"] else None,
            },
            "plan": result["plan"]
        }
    except Exception as e:
        logger.error(f"Registration failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "REGISTRATION_FAILED",
                    "message": str(e)
                }
            }
        )


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Authenticate a user with email and password
    
    Requirements: 1.1
    
    Args:
        request: Login request containing email and password
        
    Returns:
        User data, session information, and user plan
        
    Raises:
        HTTPException: If authentication fails (401 Unauthorized)
    """
    try:
        auth_service = get_auth_service()
        result = await auth_service.authenticate_user(
            email=request.email,
            password=request.password
        )
        
        # Get user plan
        user_id = result["user"].id
        plan = await auth_service.get_user_plan(user_id)
        
        return {
            "user": {
                "id": result["user"].id,
                "email": result["user"].email,
            },
            "session": {
                "access_token": result["session"].access_token if result["session"] else None,
                "refresh_token": result["session"].refresh_token if result["session"] else None,
            },
            "plan": plan
        }
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "AUTHENTICATION_FAILED",
                    "message": "Invalid email or password"
                }
            }
        )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Medical AI Platform API",
        "docs": "/docs"
    }


# Helper function for authentication
async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """
    Extract and verify user ID from authorization header
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        User ID string
        
    Raises:
        HTTPException: If authorization fails
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "MISSING_AUTHORIZATION",
                    "message": "Authorization header is required"
                }
            }
        )
    
    # For now, we'll extract user_id from the token
    # In production, this should verify the JWT token with Supabase
    # This is a simplified implementation for the stub phase
    try:
        # Expected format: "Bearer <token>"
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {
                        "code": "INVALID_AUTHORIZATION",
                        "message": "Authorization header must start with 'Bearer '"
                    }
                }
            )
        
        token = authorization.replace("Bearer ", "")
        
        # For stub implementation, we'll accept the token as user_id
        # TODO: Implement proper JWT verification with Supabase in future tasks
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {
                        "code": "INVALID_TOKEN",
                        "message": "Invalid authorization token"
                    }
                }
            )
        
        return token
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authorization failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "AUTHORIZATION_FAILED",
                    "message": "Failed to verify authorization"
                }
            }
        )


# ============================================================================
# CHAT ENDPOINTS
# ============================================================================

@app.get("/api/chat/sessions", response_model=List[SessionResponse])
async def get_sessions(authorization: Optional[str] = Header(None)):
    """
    Get all chat sessions for the authenticated user
    
    Requirements: 3.2
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        List of chat sessions ordered by most recent
        
    Raises:
        HTTPException: If authentication fails or retrieval fails
    """
    try:
        user_id = await get_current_user_id(authorization)
        chat_service = get_chat_service()
        sessions = await chat_service.get_user_sessions(user_id)
        return sessions
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "GET_SESSIONS_FAILED",
                    "message": "Failed to retrieve chat sessions"
                }
            }
        )


@app.post("/api/chat/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: CreateSessionRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Create a new chat session for the authenticated user
    
    Requirements: 3.2
    
    Args:
        request: Session creation request with optional title
        authorization: Authorization header with Bearer token
        
    Returns:
        Created session data
        
    Raises:
        HTTPException: If authentication fails or creation fails
    """
    try:
        user_id = await get_current_user_id(authorization)
        chat_service = get_chat_service()
        session = await chat_service.create_session(user_id, request.title)
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "CREATE_SESSION_FAILED",
                    "message": "Failed to create chat session"
                }
            }
        )


@app.get("/api/chat/sessions/{session_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    session_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Get all messages for a specific chat session
    
    Requirements: 3.2, 3.4
    
    Args:
        session_id: Chat session identifier
        authorization: Authorization header with Bearer token
        
    Returns:
        List of messages ordered chronologically
        
    Raises:
        HTTPException: If authentication fails, session not found, or retrieval fails
    """
    try:
        user_id = await get_current_user_id(authorization)
        chat_service = get_chat_service()
        messages = await chat_service.get_chat_history(user_id, session_id)
        return messages
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get messages: {str(e)}")
        
        # Check if it's a session not found error
        if "Session not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "SESSION_NOT_FOUND",
                        "message": "Chat session not found or does not belong to user"
                    }
                }
            )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "GET_MESSAGES_FAILED",
                    "message": "Failed to retrieve messages"
                }
            }
        )


@app.post("/api/chat/sessions/{session_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    session_id: str,
    request: SendMessageRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Send a message in a chat session
    
    This is a stub implementation that stores the message.
    Future implementations will integrate with model router for AI responses.
    
    Requirements: 3.2, 3.4
    
    Args:
        session_id: Chat session identifier
        request: Message request with content and optional role
        authorization: Authorization header with Bearer token
        
    Returns:
        Stored message data
        
    Raises:
        HTTPException: If authentication fails, session not found, or sending fails
    """
    try:
        user_id = await get_current_user_id(authorization)
        chat_service = get_chat_service()
        message = await chat_service.send_message(
            user_id=user_id,
            session_id=session_id,
            message=request.message,
            role=request.role
        )
        return message
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send message: {str(e)}")
        
        # Check if it's a session not found error
        if "Session not found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "SESSION_NOT_FOUND",
                        "message": "Chat session not found or does not belong to user"
                    }
                }
            )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "SEND_MESSAGE_FAILED",
                    "message": "Failed to send message"
                }
            }
        )
