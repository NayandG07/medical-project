"""
Medical AI Platform - FastAPI Backend
Main application entry point
Requirements: 20.1, 20.6, 20.7, 11.1
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
import asyncio
from dotenv import load_dotenv
from services.auth import get_auth_service
from services.chat import get_chat_service
from services.rate_limiter import get_rate_limiter
from services.health_monitor import get_health_monitor
from services.encryption import get_encryption_service
from supabase import create_client

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


# Background task control
_health_check_task: Optional[asyncio.Task] = None
_health_check_running = False


async def periodic_health_check():
    """
    Background task that performs periodic health checks on all active API keys
    
    Runs every 5 minutes and checks the health of all active API keys.
    Requirements: 11.1
    """
    global _health_check_running
    
    # Initialize Supabase client for health monitor
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        logger.error("Cannot start health check task: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        return
    
    supabase_client = create_client(supabase_url, supabase_key)
    health_monitor = get_health_monitor(supabase_client)
    encryption_service = get_encryption_service()
    
    logger.info("Starting periodic health check background task (every 5 minutes)")
    _health_check_running = True
    
    while _health_check_running:
        try:
            # Get all active API keys
            result = supabase_client.table("api_keys") \
                .select("id, provider, feature, key_value, status") \
                .eq("status", "active") \
                .execute()
            
            if result.data:
                logger.info(f"Running health checks for {len(result.data)} active API keys")
                
                for key_data in result.data:
                    try:
                        # Decrypt the API key
                        decrypted_key = encryption_service.decrypt_key(key_data["key_value"])
                        
                        # Perform health check
                        health_result = await health_monitor.check_provider_health(
                            provider=key_data["provider"],
                            key=decrypted_key,
                            feature=key_data["feature"]
                        )
                        
                        # Log the health check result
                        await health_monitor.log_health_check(
                            key_id=key_data["id"],
                            status=health_result["status"],
                            response_time_ms=health_result["response_time_ms"],
                            error_message=health_result["error_message"],
                            quota_remaining=health_result["quota_remaining"]
                        )
                        
                        # If health check failed, record the failure
                        if health_result["status"] == "failed":
                            await health_monitor.record_failure(
                                key_id=key_data["id"],
                                error=health_result["error_message"] or "Health check failed",
                                provider=key_data["provider"],
                                feature=key_data["feature"]
                            )
                            logger.warning(
                                f"Health check failed for key {key_data['id']} "
                                f"({key_data['provider']}/{key_data['feature']}): "
                                f"{health_result['error_message']}"
                            )
                        else:
                            logger.debug(
                                f"Health check passed for key {key_data['id']} "
                                f"({key_data['provider']}/{key_data['feature']}) "
                                f"in {health_result['response_time_ms']}ms"
                            )
                    
                    except Exception as e:
                        logger.error(
                            f"Error checking health for key {key_data['id']}: {str(e)}",
                            exc_info=True
                        )
            else:
                logger.debug("No active API keys to check")
            
        except Exception as e:
            logger.error(f"Error in periodic health check: {str(e)}", exc_info=True)
        
        # Wait 5 minutes before next check
        await asyncio.sleep(300)  # 300 seconds = 5 minutes


@app.on_event("startup")
async def startup_event():
    """
    FastAPI startup event handler
    Starts background tasks including periodic health checks
    
    Requirements: 11.1
    """
    global _health_check_task
    
    logger.info("Application starting up...")
    
    # Start periodic health check background task
    _health_check_task = asyncio.create_task(periodic_health_check())
    logger.info("Periodic health check task started")


@app.on_event("shutdown")
async def shutdown_event():
    """
    FastAPI shutdown event handler
    Stops background tasks gracefully
    """
    global _health_check_task, _health_check_running
    
    logger.info("Application shutting down...")
    
    # Stop health check task
    if _health_check_task:
        _health_check_running = False
        _health_check_task.cancel()
        try:
            await _health_check_task
        except asyncio.CancelledError:
            logger.info("Health check task cancelled")
    
    logger.info("Application shutdown complete")


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
    
    Requirements: 3.2, 3.4, 9.2, 9.3, 28.2
    
    Args:
        session_id: Chat session identifier
        request: Message request with content and optional role
        authorization: Authorization header with Bearer token
        
    Returns:
        Stored message data
        
    Raises:
        HTTPException: If authentication fails, rate limit exceeded, session not found, or sending fails
    """
    try:
        user_id = await get_current_user_id(authorization)
        
        # Check rate limits before processing (Requirement 9.2)
        rate_limiter = get_rate_limiter()
        within_limits = await rate_limiter.check_rate_limit(user_id, "chat")
        
        if not within_limits:
            # Get current usage for detailed error message
            usage = await rate_limiter.get_user_usage(user_id)
            
            # Get user plan for limit information
            auth_service = get_auth_service()
            plan = await auth_service.get_user_plan(user_id)
            
            # Import plan limits
            from services.rate_limiter import PLAN_LIMITS
            limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
            
            # Requirement 9.3, 28.2: Return 429 with upgrade prompt
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"You've reached your daily limit. Upgrade to continue using the service.",
                        "details": {
                            "current_plan": plan,
                            "tokens_used": usage["tokens_used"],
                            "tokens_limit": limits["daily_tokens"],
                            "requests_used": usage["requests_count"],
                            "requests_limit": limits["daily_requests"],
                        },
                        "action": "upgrade",
                        "upgrade_url": "/pricing"
                    }
                }
            )
        
        # Process message if within limits
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


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

# Pydantic models for admin endpoints
class UpdatePlanRequest(BaseModel):
    """Request model for updating user plan"""
    plan: str


class AdminUserResponse(BaseModel):
    """Response model for admin user operations"""
    id: str
    email: str
    name: str
    plan: str
    role: Optional[str]
    disabled: bool
    created_at: str


class AuditLogResponse(BaseModel):
    """Response model for audit log"""
    id: str
    admin_id: str
    action_type: str
    target_type: str
    target_id: str
    details: Optional[dict]
    timestamp: str


class AddApiKeyRequest(BaseModel):
    """Request model for adding an API key"""
    provider: str
    feature: str
    key: str
    priority: int = 0


class UpdateKeyStatusRequest(BaseModel):
    """Request model for updating API key status"""
    status: str


class TestApiKeyRequest(BaseModel):
    """Request model for testing an API key"""
    key: str
    provider: str


class ApiKeyResponse(BaseModel):
    """Response model for API key (with encrypted key_value)"""
    id: str
    provider: str
    feature: str
    key_value: str  # Encrypted
    priority: int
    status: str
    failure_count: int
    last_used_at: Optional[str]
    created_at: str
    updated_at: str


class TestApiKeyResponse(BaseModel):
    """Response model for API key test"""
    valid: bool
    message: str


# Helper function for admin authentication
async def require_admin(authorization: Optional[str] = Header(None)) -> str:
    """
    Verify that the current user is an admin
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        Admin user ID
        
    Raises:
        HTTPException: If not authenticated or not an admin
    """
    from middleware.admin_auth import get_admin_auth_middleware
    
    # Get user ID from authorization
    user_id = await get_current_user_id(authorization)
    
    # Create mock request for admin middleware
    class MockRequest:
        def __init__(self, auth_header):
            self.headers = {"X-Emergency-Admin-Token": auth_header.replace("Bearer ", "") if auth_header else None}
        
        def get(self, key, default=None):
            return self.headers.get(key, default)
    
    mock_request = MockRequest(authorization)
    
    # Verify admin access
    admin_middleware = get_admin_auth_middleware()
    await admin_middleware.require_admin(mock_request, user_id)
    
    return user_id


@app.get("/api/admin/users", response_model=List[AdminUserResponse])
async def admin_list_users(
    plan: Optional[str] = None,
    role: Optional[str] = None,
    disabled: Optional[bool] = None,
    limit: int = 100,
    authorization: Optional[str] = Header(None)
):
    """
    List users with optional filtering (admin only)
    
    Requirements: 13.1, 2.7
    
    Args:
        plan: Optional filter by plan
        role: Optional filter by role
        disabled: Optional filter by disabled status
        limit: Maximum number of users to return
        authorization: Authorization header with Bearer token
        
    Returns:
        List of users
        
    Raises:
        HTTPException: If not authenticated, not admin, or retrieval fails
    """
    try:
        # Verify admin access
        await require_admin(authorization)
        
        # Get users
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        users = await admin_service.list_users(
            plan=plan,
            role=role,
            disabled=disabled,
            limit=limit
        )
        
        return users
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "LIST_USERS_FAILED",
                    "message": "Failed to retrieve users"
                }
            }
        )


@app.put("/api/admin/users/{user_id}/plan", response_model=AdminUserResponse)
async def admin_update_user_plan(
    user_id: str,
    request: UpdatePlanRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Update a user's plan (admin only)
    
    Requirements: 13.3, 2.7
    
    Args:
        user_id: ID of the user to update
        request: Plan update request
        authorization: Authorization header with Bearer token
        
    Returns:
        Updated user data
        
    Raises:
        HTTPException: If not authenticated, not admin, or update fails
    """
    try:
        # Verify admin access
        admin_id = await require_admin(authorization)
        
        # Update user plan
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        updated_user = await admin_service.update_user_plan(
            admin_id=admin_id,
            user_id=user_id,
            new_plan=request.plan
        )
        
        return updated_user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user plan: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "UPDATE_PLAN_FAILED",
                    "message": str(e)
                }
            }
        )


@app.post("/api/admin/users/{user_id}/usage/reset")
async def admin_reset_user_usage(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Reset a user's usage counters (admin only)
    
    Requirements: 13.4, 2.7
    
    Args:
        user_id: ID of the user whose usage to reset
        authorization: Authorization header with Bearer token
        
    Returns:
        Reset confirmation
        
    Raises:
        HTTPException: If not authenticated, not admin, or reset fails
    """
    try:
        # Verify admin access
        admin_id = await require_admin(authorization)
        
        # Reset user usage
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        result = await admin_service.reset_user_usage(
            admin_id=admin_id,
            user_id=user_id
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reset user usage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "RESET_USAGE_FAILED",
                    "message": str(e)
                }
            }
        )


@app.post("/api/admin/users/{user_id}/disable", response_model=AdminUserResponse)
async def admin_disable_user(
    user_id: str,
    disabled: bool = True,
    authorization: Optional[str] = Header(None)
):
    """
    Disable or enable a user account (admin only)
    
    Requirements: 13.5, 2.7
    
    Args:
        user_id: ID of the user to disable/enable
        disabled: True to disable, False to enable
        authorization: Authorization header with Bearer token
        
    Returns:
        Updated user data
        
    Raises:
        HTTPException: If not authenticated, not admin, or update fails
    """
    try:
        # Verify admin access
        admin_id = await require_admin(authorization)
        
        # Disable/enable user
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        updated_user = await admin_service.disable_user(
            admin_id=admin_id,
            user_id=user_id,
            disabled=disabled
        )
        
        return updated_user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to disable/enable user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "DISABLE_USER_FAILED",
                    "message": str(e)
                }
            }
        )


@app.get("/api/admin/audit-logs", response_model=List[AuditLogResponse])
async def admin_get_audit_logs(
    admin_id: Optional[str] = None,
    action_type: Optional[str] = None,
    target_type: Optional[str] = None,
    limit: int = 100,
    authorization: Optional[str] = Header(None)
):
    """
    Get audit logs with optional filtering (admin only)
    
    Requirements: 19.6, 2.7
    
    Args:
        admin_id: Optional filter by admin ID
        action_type: Optional filter by action type
        target_type: Optional filter by target type
        limit: Maximum number of logs to return
        authorization: Authorization header with Bearer token
        
    Returns:
        List of audit logs
        
    Raises:
        HTTPException: If not authenticated, not admin, or retrieval fails
    """
    try:
        # Verify admin access
        await require_admin(authorization)
        
        # Get audit logs
        from services.audit import get_audit_service
        audit_service = get_audit_service()
        logs = await audit_service.get_audit_logs(
            admin_id=admin_id,
            action_type=action_type,
            target_type=target_type,
            limit=limit
        )
        
        return logs
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get audit logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "GET_AUDIT_LOGS_FAILED",
                    "message": "Failed to retrieve audit logs"
                }
            }
        )



# ============================================================================
# API KEY MANAGEMENT ENDPOINTS
# ============================================================================

@app.get("/api/admin/api-keys", response_model=List[ApiKeyResponse])
async def admin_list_api_keys(
    authorization: Optional[str] = Header(None)
):
    """
    List all API keys (admin only)
    
    Requirements: 14.2, 2.7
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        List of API keys (with encrypted key values)
        
    Raises:
        HTTPException: If not authenticated, not admin, or retrieval fails
    """
    try:
        # Verify admin access
        await require_admin(authorization)
        
        # Get API keys
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        keys = await admin_service.list_api_keys()
        
        return keys
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list API keys: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "LIST_API_KEYS_FAILED",
                    "message": "Failed to retrieve API keys"
                }
            }
        )


@app.post("/api/admin/api-keys", response_model=ApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def admin_add_api_key(
    request: AddApiKeyRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Add a new API key (admin only)
    
    Requirements: 14.2, 2.7
    
    Args:
        request: API key addition request
        authorization: Authorization header with Bearer token
        
    Returns:
        Created API key data (with encrypted key value)
        
    Raises:
        HTTPException: If not authenticated, not admin, or creation fails
    """
    try:
        # Verify admin access
        admin_id = await require_admin(authorization)
        
        # Add API key
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        created_key = await admin_service.add_api_key(
            admin_id=admin_id,
            provider=request.provider,
            feature=request.feature,
            key=request.key,
            priority=request.priority
        )
        
        return created_key
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add API key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "ADD_API_KEY_FAILED",
                    "message": str(e)
                }
            }
        )


@app.put("/api/admin/api-keys/{key_id}", response_model=ApiKeyResponse)
async def admin_update_api_key_status(
    key_id: str,
    request: UpdateKeyStatusRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Update an API key's status (admin only)
    
    Requirements: 14.4, 2.7
    
    Args:
        key_id: ID of the API key to update
        request: Status update request
        authorization: Authorization header with Bearer token
        
    Returns:
        Updated API key data
        
    Raises:
        HTTPException: If not authenticated, not admin, or update fails
    """
    try:
        # Verify admin access
        admin_id = await require_admin(authorization)
        
        # Update key status
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        updated_key = await admin_service.update_key_status(
            admin_id=admin_id,
            key_id=key_id,
            status=request.status
        )
        
        return updated_key
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update API key status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "UPDATE_KEY_STATUS_FAILED",
                    "message": str(e)
                }
            }
        )


@app.delete("/api/admin/api-keys/{key_id}")
async def admin_delete_api_key(
    key_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Delete an API key (admin only)
    
    Requirements: 14.6, 2.7
    
    Args:
        key_id: ID of the API key to delete
        authorization: Authorization header with Bearer token
        
    Returns:
        Deletion confirmation
        
    Raises:
        HTTPException: If not authenticated, not admin, or deletion fails
    """
    try:
        # Verify admin access
        admin_id = await require_admin(authorization)
        
        # Delete API key
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        result = await admin_service.delete_api_key(
            admin_id=admin_id,
            key_id=key_id
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete API key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "DELETE_API_KEY_FAILED",
                    "message": str(e)
                }
            }
        )


@app.post("/api/admin/api-keys/test", response_model=TestApiKeyResponse)
async def admin_test_api_key(
    request: TestApiKeyRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Test an API key before storage (admin only)
    
    Requirements: 14.7, 2.7
    
    Args:
        request: API key test request
        authorization: Authorization header with Bearer token
        
    Returns:
        Test result with validation status
        
    Raises:
        HTTPException: If not authenticated, not admin, or test fails
    """
    try:
        # Verify admin access
        await require_admin(authorization)
        
        # Test API key
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        result = await admin_service.test_api_key(
            key=request.key,
            provider=request.provider
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test API key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "TEST_API_KEY_FAILED",
                    "message": str(e)
                }
            }
        )


# ============================================================================
# MAINTENANCE CONTROL ENDPOINTS
# ============================================================================

class MaintenanceStatusResponse(BaseModel):
    """Response model for maintenance status"""
    in_maintenance: bool
    level: Optional[str]
    reason: Optional[str]
    feature: Optional[str]
    triggered_by: Optional[str]
    triggered_at: Optional[str]


class TriggerMaintenanceRequest(BaseModel):
    """Request model for triggering maintenance"""
    level: str  # soft or hard
    reason: str
    feature: Optional[str] = None


@app.get("/api/admin/maintenance", response_model=MaintenanceStatusResponse)
async def admin_get_maintenance_status(
    authorization: Optional[str] = Header(None)
):
    """
    Get current maintenance status (admin only)
    
    Requirements: 17.1, 2.7
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        Current maintenance status
        
    Raises:
        HTTPException: If not authenticated, not admin, or retrieval fails
    """
    try:
        # Verify admin access
        await require_admin(authorization)
        
        # Get maintenance status
        from services.maintenance import get_maintenance_service
        
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        supabase_client = create_client(supabase_url, supabase_key)
        
        maintenance_service = get_maintenance_service(supabase_client)
        status_data = await maintenance_service.get_maintenance_status()
        
        return status_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get maintenance status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "GET_MAINTENANCE_STATUS_FAILED",
                    "message": "Failed to retrieve maintenance status"
                }
            }
        )


@app.post("/api/admin/maintenance", response_model=MaintenanceStatusResponse)
async def admin_trigger_maintenance(
    request: TriggerMaintenanceRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Manually trigger maintenance mode (admin only)
    
    Requirements: 17.2, 2.7
    
    Args:
        request: Maintenance trigger request
        authorization: Authorization header with Bearer token
        
    Returns:
        Updated maintenance status
        
    Raises:
        HTTPException: If not authenticated, not admin, or trigger fails
    """
    try:
        # Verify admin access
        admin_id = await require_admin(authorization)
        
        # Validate level
        if request.level not in ["soft", "hard"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": {
                        "code": "INVALID_MAINTENANCE_LEVEL",
                        "message": "Maintenance level must be 'soft' or 'hard'"
                    }
                }
            )
        
        # Trigger maintenance
        from services.maintenance import get_maintenance_service
        
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        supabase_client = create_client(supabase_url, supabase_key)
        
        maintenance_service = get_maintenance_service(supabase_client)
        result = await maintenance_service.enter_maintenance(
            level=request.level,
            reason=request.reason,
            feature=request.feature,
            triggered_by=admin_id
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger maintenance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "TRIGGER_MAINTENANCE_FAILED",
                    "message": str(e)
                }
            }
        )


@app.post("/api/admin/maintenance/override")
async def admin_override_maintenance(
    authorization: Optional[str] = Header(None)
):
    """
    Override maintenance mode and restore normal operation (admin only)
    
    Requirements: 17.3, 12.8, 2.7
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        Confirmation of override
        
    Raises:
        HTTPException: If not authenticated, not admin, or override fails
    """
    try:
        # Verify admin access
        admin_id = await require_admin(authorization)
        
        # Exit maintenance
        from services.maintenance import get_maintenance_service
        
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        supabase_client = create_client(supabase_url, supabase_key)
        
        maintenance_service = get_maintenance_service(supabase_client)
        result = await maintenance_service.exit_maintenance(exited_by=admin_id)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to override maintenance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "OVERRIDE_MAINTENANCE_FAILED",
                    "message": str(e)
                }
            }
        )


# ============================================================================
# PROVIDER HEALTH ENDPOINTS
# ============================================================================

class ProviderHealthStatusResponse(BaseModel):
    """Response model for provider health status"""
    provider: str
    feature: str
    status: str
    active_keys: int
    degraded_keys: int
    disabled_keys: int
    recent_failures: List[dict]


class HealthCheckResponse(BaseModel):
    """Response model for health check"""
    key_id: str
    status: str
    response_time_ms: Optional[int]
    error_message: Optional[str]


@app.get("/api/admin/provider-health", response_model=List[ProviderHealthStatusResponse])
async def admin_get_provider_health(
    authorization: Optional[str] = Header(None)
):
    """
    Get provider health status for all providers and features (admin only)
    
    Requirements: 15.1, 15.2, 15.3, 2.7
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        List of provider health statuses
        
    Raises:
        HTTPException: If not authenticated, not admin, or retrieval fails
    """
    try:
        # Verify admin access
        await require_admin(authorization)
        
        # Get all API keys grouped by provider/feature
        from services.health_monitor import get_health_monitor
        
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        supabase_client = create_client(supabase_url, supabase_key)
        
        # Get all keys
        keys_result = supabase_client.table("api_keys") \
            .select("id, provider, feature, status") \
            .execute()
        
        if not keys_result.data:
            return []
        
        # Group by provider/feature
        provider_features = {}
        for key in keys_result.data:
            pf_key = f"{key['provider']}:{key['feature']}"
            if pf_key not in provider_features:
                provider_features[pf_key] = {
                    "provider": key["provider"],
                    "feature": key["feature"],
                    "active_keys": 0,
                    "degraded_keys": 0,
                    "disabled_keys": 0,
                    "key_ids": []
                }
            
            if key["status"] == "active":
                provider_features[pf_key]["active_keys"] += 1
            elif key["status"] == "degraded":
                provider_features[pf_key]["degraded_keys"] += 1
            elif key["status"] == "disabled":
                provider_features[pf_key]["disabled_keys"] += 1
            
            provider_features[pf_key]["key_ids"].append(key["id"])
        
        # Get recent failures for each provider/feature
        health_monitor = get_health_monitor(supabase_client)
        results = []
        
        for pf_data in provider_features.values():
            # Get recent health checks
            recent_checks = supabase_client.table("provider_health") \
                .select("*") \
                .in_("api_key_id", pf_data["key_ids"]) \
                .order("checked_at", desc=True) \
                .limit(10) \
                .execute()
            
            # Filter for failures
            recent_failures = [
                {
                    "checked_at": check["checked_at"],
                    "status": check["status"],
                    "error_message": check.get("error_message"),
                    "response_time_ms": check.get("response_time_ms")
                }
                for check in recent_checks.data
                if check["status"] in ["failed", "degraded"]
            ]
            
            # Determine overall status
            if pf_data["active_keys"] > 0:
                status = "healthy"
            elif pf_data["degraded_keys"] > 0:
                status = "degraded"
            else:
                status = "failed"
            
            results.append({
                "provider": pf_data["provider"],
                "feature": pf_data["feature"],
                "status": status,
                "active_keys": pf_data["active_keys"],
                "degraded_keys": pf_data["degraded_keys"],
                "disabled_keys": pf_data["disabled_keys"],
                "recent_failures": recent_failures
            })
        
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get provider health: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "GET_PROVIDER_HEALTH_FAILED",
                    "message": "Failed to retrieve provider health status"
                }
            }
        )


@app.post("/api/admin/provider-health/check")
async def admin_trigger_health_check(
    authorization: Optional[str] = Header(None)
):
    """
    Manually trigger health checks for all active API keys (admin only)
    
    Requirements: 15.4, 2.7
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        Confirmation of health check trigger
        
    Raises:
        HTTPException: If not authenticated, not admin, or trigger fails
    """
    try:
        # Verify admin access
        await require_admin(authorization)
        
        # Initialize services
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        supabase_client = create_client(supabase_url, supabase_key)
        
        from services.health_monitor import get_health_monitor
        health_monitor = get_health_monitor(supabase_client)
        encryption_service = get_encryption_service()
        
        # Get all active API keys
        keys_result = supabase_client.table("api_keys") \
            .select("id, provider, feature, key_value, status") \
            .eq("status", "active") \
            .execute()
        
        if not keys_result.data:
            return {
                "message": "No active API keys to check",
                "checked_count": 0
            }
        
        # Perform health checks
        checked_count = 0
        for key_data in keys_result.data:
            try:
                # Decrypt the API key
                decrypted_key = encryption_service.decrypt_key(key_data["key_value"])
                
                # Perform health check
                health_result = await health_monitor.check_provider_health(
                    provider=key_data["provider"],
                    key=decrypted_key,
                    feature=key_data["feature"]
                )
                
                # Log the health check result
                await health_monitor.log_health_check(
                    key_id=key_data["id"],
                    status=health_result["status"],
                    response_time_ms=health_result["response_time_ms"],
                    error_message=health_result["error_message"],
                    quota_remaining=health_result["quota_remaining"]
                )
                
                checked_count += 1
            except Exception as e:
                logger.error(f"Error checking health for key {key_data['id']}: {str(e)}")
        
        return {
            "message": f"Health checks completed for {checked_count} keys",
            "checked_count": checked_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger health checks: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "TRIGGER_HEALTH_CHECK_FAILED",
                    "message": str(e)
                }
            }
        )


# ============================================================================
# FEATURE TOGGLE ENDPOINTS
# ============================================================================

class FeatureToggleRequest(BaseModel):
    """Request model for toggling a feature"""
    enabled: bool


@app.get("/api/admin/features")
async def admin_get_feature_status(
    authorization: Optional[str] = Header(None)
):
    """
    Get the status of all feature toggles (admin only)
    
    Requirements: 16.1, 16.2, 2.7
    
    Args:
        authorization: Authorization header with Bearer token
        
    Returns:
        Dict mapping feature names to their enabled status
        
    Raises:
        HTTPException: If not authenticated, not admin, or retrieval fails
    """
    try:
        # Verify admin access
        await require_admin(authorization)
        
        # Get feature status
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        features = await admin_service.get_feature_status()
        
        return features
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get feature status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "GET_FEATURE_STATUS_FAILED",
                    "message": "Failed to retrieve feature status"
                }
            }
        )


@app.put("/api/admin/features/{feature}")
async def admin_toggle_feature(
    feature: str,
    request: FeatureToggleRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Toggle a feature on or off globally (admin only)
    
    Requirements: 16.2, 2.7
    
    Args:
        feature: Feature name to toggle
        request: Feature toggle request with enabled status
        authorization: Authorization header with Bearer token
        
    Returns:
        Result of the toggle operation
        
    Raises:
        HTTPException: If not authenticated, not admin, or toggle fails
    """
    try:
        # Verify admin access
        admin_id = await require_admin(authorization)
        
        # Toggle feature
        from services.admin import get_admin_service
        admin_service = get_admin_service()
        result = await admin_service.toggle_feature(
            admin_id=admin_id,
            feature=feature,
            enabled=request.enabled
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle feature: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "TOGGLE_FEATURE_FAILED",
                    "message": str(e)
                }
            }
        )
