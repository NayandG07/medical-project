"""
FastAPI Main Application
Medical AI Platform Backend
"""
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import logging

# Import services
from services.auth import get_auth_service
from services.chat import get_chat_service
from services.rate_limiter import get_rate_limiter
from services.admin import get_admin_service
from services.model_usage_logger import get_model_usage_logger
from services.commands import get_command_service
from services.study_tools import get_study_tools_service

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Medical AI Platform API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)


# Dependency to get current user from token
async def get_current_user(request: Request) -> Dict[str, Any]:
    """Extract and verify user from Authorization header"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = auth_header.split(" ")[1]
    
    try:
        # Verify token with Supabase
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {"id": user_response.user.id, "email": user_response.user.email}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


# Dependency to verify admin access
async def verify_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Verify user has admin role"""
    auth_service = get_auth_service(supabase)
    
    is_admin = await auth_service.verify_admin(user["id"])
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Medical AI Platform API"}


@app.get("/api/system/settings")
async def get_system_settings():
    """Get public system settings"""
    try:
        admin_service = get_admin_service(supabase)
        platform_name = await admin_service.get_system_flag("platform_name", "Vaidya AI")
        student_plan_price = await admin_service.get_system_flag("student_plan_price", "150")
        pro_plan_price = await admin_service.get_system_flag("pro_plan_price", "300")
        yearly_discount = await admin_service.get_system_flag("yearly_discount_percentage", "10")
        
        return {
            "platform_name": platform_name,
            "student_plan_price": int(student_plan_price) if student_plan_price.isdigit() else 150,
            "pro_plan_price": int(pro_plan_price) if pro_plan_price.isdigit() else 300,
            "yearly_discount_percentage": int(yearly_discount) if yearly_discount.isdigit() else 10
        }
    except Exception as e:
        logger.error(f"Failed to get system settings: {str(e)}")
        return {
            "platform_name": "Vaidya AI",
            "student_plan_price": 150,
            "pro_plan_price": 300,
            "yearly_discount_percentage": 10
        }


# ============================================================================
# ADMIN ENDPOINTS - Audit Logs
# ============================================================================

@app.get("/api/admin/audit-logs")
async def get_audit_logs(
    limit: int = 100,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Get audit logs"""
    try:
        admin_service = get_admin_service(supabase)
        logs = await admin_service.get_audit_logs(limit=limit)
        return {"logs": logs, "count": len(logs)}
    except Exception as e:
        logger.error(f"Failed to get audit logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateSystemSettingsRequest(BaseModel):
    platform_name: str
    student_plan_price: Optional[int] = 150
    pro_plan_price: Optional[int] = 300
    yearly_discount_percentage: Optional[int] = 10


@app.post("/api/admin/settings")
async def update_system_settings(
    request: UpdateSystemSettingsRequest,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Update system settings"""
    try:
        admin_service = get_admin_service(supabase)
        await admin_service.set_system_flag(admin["id"], "platform_name", request.platform_name)
        
        if request.student_plan_price is not None:
             await admin_service.set_system_flag(admin["id"], "student_plan_price", str(request.student_plan_price))
        
        if request.pro_plan_price is not None:
             await admin_service.set_system_flag(admin["id"], "pro_plan_price", str(request.pro_plan_price))
             
        if request.yearly_discount_percentage is not None:
             await admin_service.set_system_flag(admin["id"], "yearly_discount_percentage", str(request.yearly_discount_percentage))
             
        return {
            "message": "Settings updated successfully", 
            "platform_name": request.platform_name,
            "student_plan_price": request.student_plan_price,
            "pro_plan_price": request.pro_plan_price,
            "yearly_discount_percentage": request.yearly_discount_percentage
        }
    except Exception as e:
        logger.error(f"Failed to update system settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class StudyToolRequest(BaseModel):
    topic: str


@app.post("/api/study-tools/flashcards")
async def generate_flashcards(
    request: StudyToolRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate flashcards for a topic"""
    try:
        command_service = get_command_service(supabase)
        result = await command_service.generate_flashcards(user["id"], request.topic)
        return result
    except Exception as e:
        logger.error(f"Failed to generate flashcards: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/study-tools/mcqs")
async def generate_mcqs(
    request: StudyToolRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate MCQs for a topic"""
    try:
        command_service = get_command_service(supabase)
        result = await command_service.generate_mcqs(user["id"], request.topic)
        return result
    except Exception as e:
        logger.error(f"Failed to generate MCQs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/study-tools/highyield")
async def generate_highyield(
    request: StudyToolRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate high-yield summary for a topic"""
    try:
        command_service = get_command_service(supabase)
        result = await command_service.generate_summary(user["id"], request.topic)
        return result
    except Exception as e:
        logger.error(f"Failed to generate summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/study-tools/explain")
async def generate_explanation(
    request: StudyToolRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate detailed explanation for a topic"""
    try:
        command_service = get_command_service(supabase)
        result = await command_service.generate_explanation(user["id"], request.topic)
        return result
    except Exception as e:
        logger.error(f"Failed to generate explanation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/study-tools/conceptmap")
async def generate_conceptmap(
    request: StudyToolRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate concept map for a topic"""
    try:
        study_tools_service = get_study_tools_service(supabase)
        result = await study_tools_service.generate_conceptmap(
            user_id=user["id"],
            topic=request.topic,
            format=getattr(request, 'format', 'visual')
        )
        return result
    except Exception as e:
        logger.error(f"Failed to generate concept map: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN ENDPOINTS - User Management
# ============================================================================

@app.get("/api/admin/users")
async def get_users(
    limit: int = 100,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Get all users"""
    try:
        admin_service = get_admin_service(supabase)
        users = await admin_service.list_users(limit=limit)
        return {"users": users, "count": len(users)}
    except Exception as e:
        logger.error(f"Failed to get users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN ENDPOINTS - API Key Management
# ============================================================================

@app.get("/api/admin/api-keys")
async def get_api_keys(
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Get all API keys"""
    try:
        admin_service = get_admin_service(supabase)
        keys = await admin_service.list_api_keys()
        return {"keys": keys, "count": len(keys)}
    except Exception as e:
        logger.error(f"Failed to get API keys: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class AddApiKeyRequest(BaseModel):
    provider: str
    feature: str
    key: str
    priority: int = 1
    status: str = "active"


@app.post("/api/admin/api-keys")
async def add_api_key(
    request: AddApiKeyRequest,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Add a new API key"""
    try:
        admin_service = get_admin_service(supabase)
        key = await admin_service.add_api_key(
            admin_id=admin["id"],
            provider=request.provider,
            feature=request.feature,
            key=request.key,
            priority=request.priority,
            status=request.status
        )
        return key
    except Exception as e:
        logger.error(f"Failed to add API key: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateApiKeyRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[int] = None


@app.put("/api/admin/api-keys/{key_id}")
async def update_api_key(
    key_id: str,
    request: UpdateApiKeyRequest,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Update an API key's status or priority"""
    try:
        admin_service = get_admin_service(supabase)
        
        # Get current key
        keys = await admin_service.list_api_keys()
        current_key = next((k for k in keys if k["id"] == key_id), None)
        if not current_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Update fields
        update_data = {}
        if request.status is not None:
            update_data["status"] = request.status
        if request.priority is not None:
            update_data["priority"] = request.priority
        
        # Perform update
        response = supabase.table("api_keys").update(update_data).eq("id", key_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Log the action using audit service
        from services.audit import get_audit_service
        audit_service = get_audit_service(supabase)
        await audit_service.log_admin_action(
            admin_id=admin["id"],
            action_type="update_api_key",
            target_type="api_key",
            target_id=key_id,
            details=update_data
        )
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update API key: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Delete an API key"""
    try:
        admin_service = get_admin_service(supabase)
        await admin_service.delete_api_key(
            admin_id=admin["id"],
            key_id=key_id
        )
        return {"message": "API key deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete API key: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN ENDPOINTS - Feature Management
# ============================================================================

@app.get("/api/admin/features")
async def get_features(
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Get all feature statuses"""
    try:
        admin_service = get_admin_service(supabase)
        features = await admin_service.get_feature_status()
        return features
    except Exception as e:
        logger.error(f"Failed to get features: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))




# ============================================================================
# CHAT ENDPOINTS
# ============================================================================

@app.get("/api/chat/sessions")
async def get_chat_sessions(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's chat sessions"""
    try:
        chat_service = get_chat_service(supabase)
        sessions = await chat_service.get_user_sessions(user["id"])
        return sessions
    except Exception as e:
        logger.error(f"Failed to get chat sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class CreateSessionRequest(BaseModel):
    title: Optional[str] = "New Chat"


@app.post("/api/chat/sessions", status_code=201)
async def create_chat_session(
    request: CreateSessionRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new chat session"""
    try:
        chat_service = get_chat_service(supabase)
        session = await chat_service.create_session(user["id"], request.title)
        return session
    except Exception as e:
        logger.error(f"Failed to create chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/chat/sessions/{session_id}/messages")
async def get_chat_messages(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get messages for a session"""
    try:
        chat_service = get_chat_service(supabase)
        messages = await chat_service.get_chat_history(user["id"], session_id)
        return messages
    except Exception as e:
        if "not found" in str(e).lower() or "belong to user" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        logger.error(f"Failed to get chat messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a chat session"""
    try:
        chat_service = get_chat_service(supabase)
        # Verify ownership before deletion (service should handle this or we do it here)
        # Ideally chat_service.delete_session(user_id, session_id)
        await chat_service.delete_session(user["id"], session_id)
        return {"message": "Session deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class SendMessageRequest(BaseModel):
    message: str
    role: str = "user"


@app.post("/api/chat/sessions/{session_id}/messages", status_code=201)
async def send_chat_message(
    session_id: str,
    request: SendMessageRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Send a message to a chat session"""
    try:
        chat_service = get_chat_service(supabase)
        
        # Check rate limit (if available)
        try:
            rate_limiter = get_rate_limiter(supabase)
            has_capacity = await rate_limiter.check_rate_limit(user["id"], "chat")
            if not has_capacity:
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Please upgrade your plan.")
        except Exception as rl_error:
            # If rate limiter fails, we still allow the message for now
            logger.warning(f"Rate limiter check failed: {str(rl_error)}")
            
        message = await chat_service.send_message(
            user_id=user["id"],
            session_id=session_id,
            message=request.message,
            role=request.role
        )
        return message
    except HTTPException:
        raise
    except Exception as e:
        if "not found" in str(e).lower() or "belong to user" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        logger.error(f"Failed to send chat message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN ENDPOINTS - Model Usage Reports
# ============================================================================

@app.get("/api/admin/model-usage/stats")
async def get_model_usage_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    provider: Optional[str] = None,
    feature: Optional[str] = None,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """
    Get model usage statistics
    
    Query parameters:
    - start_date: Start date (ISO format)
    - end_date: End date (ISO format)
    - provider: Filter by provider
    - feature: Filter by feature
    """
    try:
        usage_logger = get_model_usage_logger(supabase)
        
        stats = await usage_logger.get_usage_stats(
            start_date=start_date,
            end_date=end_date,
            provider=provider,
            feature=feature
        )
        
        return stats
    except Exception as e:
        logger.error(f"Failed to get model usage stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/model-usage/logs")
async def get_model_usage_logs(
    limit: int = 100,
    provider: Optional[str] = None,
    feature: Optional[str] = None,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """
    Get recent model usage logs
    
    Query parameters:
    - limit: Maximum number of logs to return (default: 100)
    - provider: Filter by provider
    - feature: Filter by feature
    """
    try:
        usage_logger = get_model_usage_logger(supabase)
        
        logs = await usage_logger.get_recent_logs(
            limit=limit,
            provider=provider,
            feature=feature
        )
        
        return {"logs": logs, "count": len(logs)}
    except Exception as e:
        logger.error(f"Failed to get model usage logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/model-usage/fallback-report")
async def get_fallback_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """
    Get detailed fallback report
    
    Query parameters:
    - start_date: Start date (ISO format)
    - end_date: End date (ISO format)
    """
    try:
        usage_logger = get_model_usage_logger(supabase)
        
        report = await usage_logger.get_fallback_report(
            start_date=start_date,
            end_date=end_date
        )
        
        return report
    except Exception as e:
        logger.error(f"Failed to get fallback report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN ENDPOINTS - Health Checks
# ============================================================================

@app.get("/api/admin/health/check-all")
async def run_health_checks(
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """
    Run health checks on all providers (paid APIs + Hugging Face)
    
    Returns health status for all API keys and fallback models
    """
    try:
        from services.health_check_scheduler import get_health_check_scheduler
        
        scheduler = get_health_check_scheduler(supabase)
        results = await scheduler.run_health_checks()
        
        return results
    except Exception as e:
        logger.error(f"Failed to run health checks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/health/huggingface")
async def check_huggingface_health(
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """
    Check health of Hugging Face fallback models
    
    Returns health status for all Hugging Face models
    """
    try:
        from services.health_check_scheduler import get_health_check_scheduler
        from datetime import datetime
        
        scheduler = get_health_check_scheduler(supabase)
        results = await scheduler.check_huggingface_models()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "results": results,
            "total": len(results),
            "healthy": sum(1 for r in results if r["success"]),
            "unhealthy": sum(1 for r in results if not r["success"])
        }
    except Exception as e:
        logger.error(f"Failed to check Hugging Face health: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/health/paid-apis")
async def check_paid_apis_health(
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """
    Check health of paid API keys
    
    Returns health status for all active paid API keys
    """
    try:
        from services.health_check_scheduler import get_health_check_scheduler
        from datetime import datetime
        
        scheduler = get_health_check_scheduler(supabase)
        results = await scheduler.check_paid_api_keys()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "results": results,
            "total": len(results),
            "healthy": sum(1 for r in results if r["success"]),
            "unhealthy": sum(1 for r in results if not r["success"])
        }
    except Exception as e:
        logger.error(f"Failed to check paid APIs health: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Run the application
if __name__ == "__main__":
    import uvicorn
    # Use string reference for app to enable reload
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
