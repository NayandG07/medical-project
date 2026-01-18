"""
FastAPI Main Application
Medical AI Platform Backend
"""
from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File, Form
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
from services.documents import get_document_service

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
    session_id: Optional[str] = None


@app.post("/api/study-tools/flashcards")
async def generate_flashcards(
    request: StudyToolRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate flashcards for a topic"""
    try:
        study_tools_service = get_study_tools_service(supabase)
        result = await study_tools_service.generate_flashcards(
            user_id=user["id"],
            topic=request.topic,
            session_id=request.session_id
        )
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
        study_tools_service = get_study_tools_service(supabase)
        result = await study_tools_service.generate_mcq(
            user_id=user["id"],
            topic=request.topic,
            session_id=request.session_id
        )
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
        study_tools_service = get_study_tools_service(supabase)
        result = await study_tools_service.generate_highyield(
            user_id=user["id"],
            topic=request.topic,
            session_id=request.session_id
        )
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
        study_tools_service = get_study_tools_service(supabase)
        result = await study_tools_service.generate_explanation(
            user_id=user["id"],
            topic=request.topic,
            session_id=request.session_id
        )
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


class UpdateUserPlanRequest(BaseModel):
    plan: str


@app.put("/api/admin/users/{user_id}/plan")
async def update_user_plan(
    user_id: str,
    request: UpdateUserPlanRequest,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Update a user's plan"""
    try:
        admin_service = get_admin_service(supabase)
        result = await admin_service.update_user_plan(
            admin_id=admin["id"],
            user_id=user_id,
            new_plan=request.plan
        )
        return result
    except Exception as e:
        logger.error(f"Failed to update user plan: {str(e)}")
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
# STUDY TOOL SESSION ENDPOINTS
# ============================================================================

@app.get("/api/study-tools/sessions")
async def get_study_tool_sessions(
    feature: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's study tool sessions, optionally filtered by feature"""
    try:
        study_tools_service = get_study_tools_service(supabase)
        sessions = await study_tools_service.get_user_sessions(user["id"], feature)
        return sessions
    except Exception as e:
        logger.error(f"Failed to get study tool sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/study-tools/sessions", status_code=201)
async def create_study_tool_session(
    request: CreateSessionRequest,
    feature: str = "mcq",
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new study tool session"""
    try:
        study_tools_service = get_study_tools_service(supabase)
        session = await study_tools_service.create_session(user["id"], feature, request.title)
        return session
    except Exception as e:
        logger.error(f"Failed to create study tool session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/study-tools/sessions/{session_id}/materials")
async def get_session_materials_history(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get materials for a study tool session"""
    try:
        study_tools_service = get_study_tools_service(supabase)
        materials = await study_tools_service.get_session_materials(session_id, user["id"])
        return materials
    except Exception as e:
        logger.error(f"Failed to get session materials: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/study-tools/sessions/{session_id}")
async def delete_study_tool_session(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a study tool session"""
    try:
        study_tools_service = get_study_tools_service(supabase)
        await study_tools_service.delete_session(session_id, user["id"])
        return {"message": "Session deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete study tool session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DELETE ALL STUDY TOOL SESSIONS
# ============================================================================

@app.delete("/api/study-tools/sessions/all")
async def delete_all_study_tool_sessions(
    feature: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete all study tool sessions for a user, optionally filtered by feature"""
    try:
        study_tools_service = get_study_tools_service(supabase)
        sessions = await study_tools_service.get_user_sessions(user["id"], feature)
        
        deleted_count = 0
        for session in sessions:
            try:
                await study_tools_service.delete_session(session["id"], user["id"])
                deleted_count += 1
            except Exception as e:
                logger.warning(f"Failed to delete session {session['id']}: {str(e)}")
        
        return {"message": f"Deleted {deleted_count} sessions successfully", "deleted_count": deleted_count}
    except Exception as e:
        logger.error(f"Failed to delete all study tool sessions: {str(e)}")
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


# ============================================================================
# DOCUMENT ENDPOINTS
# ============================================================================

@app.post("/api/documents", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    feature: str = Form("chat"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Upload a document (PDF or image)
    
    Args:
        file: Uploaded file
        feature: Feature to enable RAG for (chat, mcq, flashcard, explain, highyield)
    """
    try:
        # Check rate limit for document uploads
        rate_limiter = get_rate_limiter(supabase)
        
        # Check feature-specific upload limit
        limit_key = f"{feature}_uploads_per_day"
        has_capacity = await rate_limiter.check_feature_limit(user["id"], limit_key)
        
        if not has_capacity:
            raise HTTPException(
                status_code=429,
                detail=f"Daily upload limit reached for {feature}. Please upgrade your plan or try tomorrow."
            )
        
        # Validate file type
        allowed_types = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and images are supported.")
        
        # Validate file size (10MB max)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
        
        # Upload document
        document_service = get_document_service(supabase)
        document = await document_service.upload_document(
            user_id=user["id"],
            file_content=file_content,
            filename=file.filename or "unnamed",
            file_type=file.content_type or "application/pdf",
            feature=feature
        )
        
        # Increment usage counter
        await rate_limiter.increment_feature_usage(user["id"], limit_key)
        
        return document
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents")
async def get_documents(
    feature: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's documents, optionally filtered by feature"""
    try:
        document_service = get_document_service(supabase)
        documents = await document_service.get_user_documents(user["id"], feature)
        return {"documents": documents, "count": len(documents)}
    except Exception as e:
        logger.error(f"Failed to get documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/documents/{document_id}")
async def delete_document(
    document_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a document"""
    try:
        document_service = get_document_service(supabase)
        await document_service.delete_document(user["id"], document_id)
        return {"message": "Document deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/search")
async def search_documents(
    query: str,
    feature: Optional[str] = None,
    top_k: int = 5,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Search documents for relevant chunks"""
    try:
        document_service = get_document_service(supabase)
        results = await document_service.search_documents(
            user_id=user["id"],
            query=query,
            feature=feature,
            top_k=top_k
        )
        return {"results": results, "count": len(results)}
    except Exception as e:
        logger.error(f"Document search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ADMIN ENDPOINTS - Rate Limits & Quotas
# ============================================================================

class RateLimitsRequest(BaseModel):
    plan: str
    limits: Dict[str, int]


@app.get("/api/admin/rate-limits")
async def get_rate_limits(
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Get rate limits for all plans"""
    try:
        admin_service = get_admin_service(supabase)
        plans = ["free", "student", "pro"]
        
        all_limits = {}
        for plan in plans:
            # Document retention
            retention = await admin_service.get_system_flag(f"document_retention_{plan}", "14")
            doc_uploads = await admin_service.get_system_flag(f"document_uploads_daily_{plan}", "5")
            
            # Feature limits
            chat_limit = await admin_service.get_system_flag(f"chat_daily_limit_{plan}", "20")
            mcq_limit = await admin_service.get_system_flag(f"mcq_daily_limit_{plan}", "10")
            flashcard_limit = await admin_service.get_system_flag(f"flashcard_daily_limit_{plan}", "10")
            explain_limit = await admin_service.get_system_flag(f"explain_daily_limit_{plan}", "5")
            highyield_limit = await admin_service.get_system_flag(f"highyield_daily_limit_{plan}", "5")
            
            all_limits[plan] = {
                "document_retention_days": int(retention) if retention.isdigit() else 14,
                "document_uploads_daily": int(doc_uploads) if doc_uploads.isdigit() else 5,
                "chat_daily_limit": int(chat_limit) if chat_limit.isdigit() else 20,
                "mcq_daily_limit": int(mcq_limit) if mcq_limit.isdigit() else 10,
                "flashcard_daily_limit": int(flashcard_limit) if flashcard_limit.isdigit() else 10,
                "explain_daily_limit": int(explain_limit) if explain_limit.isdigit() else 5,
                "highyield_daily_limit": int(highyield_limit) if highyield_limit.isdigit() else 5
            }
        
        return all_limits
    except Exception as e:
        logger.error(f"Failed to get rate limits: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/rate-limits")
async def update_rate_limits(
    request: RateLimitsRequest,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Update rate limits for a plan"""
    try:
        admin_service = get_admin_service(supabase)
        plan = request.plan
        limits = request.limits
        
        # Update document retention
        if "document_retention_days" in limits:
            await admin_service.set_system_flag(
                admin["id"],
                f"document_retention_{plan}",
                str(limits["document_retention_days"])
            )
        
        # Update document uploads
        if "document_uploads_daily" in limits:
            await admin_service.set_system_flag(
                admin["id"],
                f"document_uploads_daily_{plan}",
                str(limits["document_uploads_daily"])
            )
        
        # Update feature limits
        for feature in ["chat", "mcq", "flashcard", "explain", "highyield"]:
            limit_key = f"{feature}_daily_limit"
            if limit_key in limits:
                await admin_service.set_system_flag(
                    admin["id"],
                    f"{limit_key}_{plan}",
                    str(limits[limit_key])
                )
        
        return {
            "message": f"Rate limits for {plan} plan updated successfully",
            "plan": plan,
            "limits": limits
        }
    except Exception as e:
        logger.error(f"Failed to update rate limits: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# RAG MONITORING ENDPOINTS
# ============================================================================

@app.get("/api/admin/rag-stats")
async def get_rag_stats(
    time_range: str = "24h",
    feature: Optional[str] = None,
    admin: Dict[str, Any] = Depends(verify_admin)
):
    """Get RAG usage statistics"""
    try:
        from datetime import timedelta
        
        # Calculate time range
        time_ranges = {
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30)
        }
        delta = time_ranges.get(time_range, timedelta(hours=24))
        start_time = datetime.now() - delta
        
        # Build query
        query = supabase.table("rag_usage_logs").select("*").gte("timestamp", start_time.isoformat())
        
        if feature and feature != "all":
            query = query.eq("feature", feature)
        
        result = query.execute()
        logs = result.data or []
        
        # Calculate stats
        total_queries = len(logs)
        successful_queries = sum(1 for log in logs if log.get("success", False))
        
        # Calculate average grounding score
        grounding_scores = [log.get("grounding_score") for log in logs if log.get("grounding_score") is not None]
        avg_grounding_score = sum(grounding_scores) / len(grounding_scores) if grounding_scores else None
        
        # Group by feature
        by_feature = {}
        for log in logs:
            feat = log.get("feature", "unknown")
            by_feature[feat] = by_feature.get(feat, 0) + 1
        
        # Get recent logs (last 20)
        recent_logs = sorted(logs, key=lambda x: x.get("timestamp", ""), reverse=True)[:20]
        
        return {
            "total_queries": total_queries,
            "successful_queries": successful_queries,
            "avg_grounding_score": avg_grounding_score,
            "by_feature": by_feature,
            "recent_logs": recent_logs
        }
    except Exception as e:
        logger.error(f"Failed to get RAG stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DOCUMENT ENDPOINTS (kept for backward compatibility, but simplified)
# ============================================================================


# ============================================================================
# STUDY PLANNER ENDPOINTS
# ============================================================================

from services.enhanced_study_planner import get_enhanced_study_planner_service


class CreatePlanEntryRequest(BaseModel):
    subject: str
    study_type: str
    scheduled_date: str
    start_time: str
    end_time: str
    topic: Optional[str] = None
    priority: str = "medium"
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    color_code: str = "#5C67F2"
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None


@app.post("/api/planner/entries", status_code=201)
async def create_plan_entry(
    request: CreatePlanEntryRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new study plan entry"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        entry = await planner_service.create_plan_entry(
            user_id=user["id"],
            subject=request.subject,
            study_type=request.study_type,
            scheduled_date=request.scheduled_date,
            start_time=request.start_time,
            end_time=request.end_time,
            topic=request.topic,
            priority=request.priority,
            notes=request.notes,
            tags=request.tags,
            color_code=request.color_code,
            is_recurring=request.is_recurring,
            recurrence_pattern=request.recurrence_pattern
        )
        return entry
    except Exception as e:
        logger.error(f"Failed to create plan entry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/planner/entries")
async def get_plan_entries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    study_type: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get study plan entries with optional filters"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        entries = await planner_service.get_plan_entries(
            user_id=user["id"],
            start_date=start_date,
            end_date=end_date,
            status=status,
            study_type=study_type
        )
        return {"entries": entries, "count": len(entries)}
    except Exception as e:
        logger.error(f"Failed to get plan entries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/planner/entries/daily/{target_date}")
async def get_daily_entries(
    target_date: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get all entries for a specific day"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        entries = await planner_service.get_daily_entries(user["id"], target_date)
        return {"entries": entries, "count": len(entries), "date": target_date}
    except Exception as e:
        logger.error(f"Failed to get daily entries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/planner/entries/weekly/{week_start}")
async def get_weekly_entries(
    week_start: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get all entries for a week"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        entries = await planner_service.get_weekly_entries(user["id"], week_start)
        return {"entries": entries, "count": len(entries), "week_start": week_start}
    except Exception as e:
        logger.error(f"Failed to get weekly entries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/planner/entries/monthly/{year}/{month}")
async def get_monthly_entries(
    year: int,
    month: int,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get all entries for a month"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        entries = await planner_service.get_monthly_entries(user["id"], year, month)
        return {"entries": entries, "count": len(entries), "year": year, "month": month}
    except Exception as e:
        logger.error(f"Failed to get monthly entries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdatePlanEntryRequest(BaseModel):
    subject: Optional[str] = None
    topic: Optional[str] = None
    study_type: Optional[str] = None
    scheduled_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    color_code: Optional[str] = None
    completion_percentage: Optional[int] = None


@app.put("/api/planner/entries/{entry_id}")
async def update_plan_entry(
    entry_id: str,
    request: UpdatePlanEntryRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Update a study plan entry"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        updates = {k: v for k, v in request.dict().items() if v is not None}
        entry = await planner_service.update_plan_entry(user["id"], entry_id, updates)
        return entry
    except Exception as e:
        logger.error(f"Failed to update plan entry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class CompletePlanEntryRequest(BaseModel):
    performance_score: Optional[int] = None
    accuracy_percentage: Optional[float] = None
    notes: Optional[str] = None


@app.post("/api/planner/entries/{entry_id}/complete")
async def complete_plan_entry(
    entry_id: str,
    request: CompletePlanEntryRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Mark a study plan entry as completed"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        entry = await planner_service.complete_entry(
            user_id=user["id"],
            entry_id=entry_id,
            performance_score=request.performance_score,
            accuracy_percentage=request.accuracy_percentage,
            notes=request.notes
        )
        return entry
    except Exception as e:
        logger.error(f"Failed to complete plan entry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/planner/entries/{entry_id}/start")
async def start_plan_entry(
    entry_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Mark a study plan entry as in progress"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        entry = await planner_service.start_entry(user["id"], entry_id)
        return entry
    except Exception as e:
        logger.error(f"Failed to start plan entry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/planner/entries/{entry_id}/skip")
async def skip_plan_entry(
    entry_id: str,
    reason: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Mark a study plan entry as skipped"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        entry = await planner_service.skip_entry(user["id"], entry_id, reason)
        return entry
    except Exception as e:
        logger.error(f"Failed to skip plan entry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class ReschedulePlanEntryRequest(BaseModel):
    new_date: str
    new_start_time: str
    new_end_time: str
    reason: Optional[str] = None


@app.post("/api/planner/entries/{entry_id}/reschedule")
async def reschedule_plan_entry(
    entry_id: str,
    request: ReschedulePlanEntryRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Reschedule a study plan entry"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        entry = await planner_service.reschedule_entry(
            user_id=user["id"],
            entry_id=entry_id,
            new_date=request.new_date,
            new_start_time=request.new_start_time,
            new_end_time=request.new_end_time,
            reason=request.reason
        )
        return entry
    except Exception as e:
        logger.error(f"Failed to reschedule plan entry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/planner/entries/{entry_id}")
async def delete_plan_entry(
    entry_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a study plan entry"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        await planner_service.delete_plan_entry(user["id"], entry_id)
        return {"message": "Entry deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete plan entry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Study Goals Endpoints
class CreateGoalRequest(BaseModel):
    title: str
    goal_type: str
    start_date: str
    end_date: str
    target_hours: Optional[float] = None
    target_sessions: Optional[int] = None
    target_topics: Optional[int] = None
    target_accuracy: Optional[float] = None
    description: Optional[str] = None


@app.post("/api/planner/goals", status_code=201)
async def create_goal(
    request: CreateGoalRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new study goal"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        goal = await planner_service.create_goal(
            user_id=user["id"],
            title=request.title,
            goal_type=request.goal_type,
            start_date=request.start_date,
            end_date=request.end_date,
            target_hours=request.target_hours,
            target_sessions=request.target_sessions,
            target_topics=request.target_topics,
            target_accuracy=request.target_accuracy,
            description=request.description
        )
        return goal
    except Exception as e:
        logger.error(f"Failed to create goal: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/planner/goals")
async def get_goals(
    status: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get study goals"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        goals = await planner_service.get_goals(user["id"], status)
        return {"goals": goals, "count": len(goals)}
    except Exception as e:
        logger.error(f"Failed to get goals: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/planner/goals/{goal_id}")
async def delete_goal(
    goal_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a study goal"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        await planner_service.delete_goal(user["id"], goal_id)
        return {"message": "Goal deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete goal: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Performance & Analytics Endpoints
@app.get("/api/planner/performance/summary")
async def get_performance_summary(
    days: int = 30,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get performance summary"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        summary = await planner_service.get_performance_summary(user["id"], days)
        return summary
    except Exception as e:
        logger.error(f"Failed to get performance summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/planner/performance/metrics")
async def get_performance_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get detailed performance metrics"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        metrics = await planner_service.get_performance_metrics(user["id"], start_date, end_date)
        return {"metrics": metrics, "count": len(metrics)}
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/planner/performance/subjects")
async def get_subject_breakdown(
    days: int = 30,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get study time breakdown by subject"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        breakdown = await planner_service.get_subject_breakdown(user["id"], days)
        return {"subjects": breakdown}
    except Exception as e:
        logger.error(f"Failed to get subject breakdown: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Streak Endpoints
@app.get("/api/planner/streak")
async def get_streak(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get current streak data"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        streak = await planner_service.get_streak(user["id"])
        return streak
    except Exception as e:
        logger.error(f"Failed to get streak: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# AI Recommendations Endpoints
@app.get("/api/planner/recommendations")
async def get_recommendations(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get AI-powered study recommendations"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        recommendations = await planner_service.generate_recommendations(user["id"])
        return {"recommendations": recommendations}
    except Exception as e:
        logger.error(f"Failed to get recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Daily Brief Endpoint
@app.get("/api/planner/daily-brief")
async def get_daily_brief(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get daily study brief"""
    try:
        planner_service = get_enhanced_study_planner_service(supabase)
        brief = await planner_service.get_daily_brief(user["id"])
        return brief
    except Exception as e:
        logger.error(f"Failed to get daily brief: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CLINICAL REASONING ENGINE ENDPOINTS
# ============================================================================

from services.clinical_reasoning_engine import get_clinical_reasoning_engine


class CreateClinicalCaseRequest(BaseModel):
    specialty: str = "general_medicine"
    difficulty: str = "intermediate"
    case_type: str = "clinical_reasoning"


class SubmitReasoningStepRequest(BaseModel):
    step_type: str
    user_input: str
    notes: Optional[str] = None


class CreateOSCERequest(BaseModel):
    scenario_type: str = "history_taking"
    specialty: str = "general_medicine"
    difficulty: str = "intermediate"


class OSCEInteractionRequest(BaseModel):
    user_action: str


@app.post("/api/clinical/cases", status_code=201)
async def create_clinical_case(
    request: CreateClinicalCaseRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate a new clinical reasoning case
    
    Creates a structured patient case with progressive information disclosure
    for clinical reasoning practice.
    """
    try:
        engine = get_clinical_reasoning_engine(supabase)
        case = await engine.generate_clinical_case(
            user_id=user["id"],
            specialty=request.specialty,
            difficulty=request.difficulty,
            case_type=request.case_type
        )
        return case
    except Exception as e:
        logger.error(f"Failed to create clinical case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clinical/cases")
async def get_clinical_cases(
    status: Optional[str] = None,
    specialty: Optional[str] = None,
    limit: int = 20,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's clinical cases with optional filters"""
    try:
        query = supabase.table("clinical_cases")\
            .select("id, case_type, specialty, difficulty, status, chief_complaint, current_stage, created_at")\
            .eq("user_id", user["id"])\
            .order("created_at", desc=True)\
            .limit(limit)
        
        if status:
            query = query.eq("status", status)
        if specialty:
            query = query.eq("specialty", specialty)
        
        response = query.execute()
        return {"cases": response.data or [], "count": len(response.data or [])}
    except Exception as e:
        logger.error(f"Failed to get clinical cases: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clinical/cases/{case_id}")
async def get_clinical_case(
    case_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get a specific clinical case with current stage data"""
    try:
        engine = get_clinical_reasoning_engine(supabase)
        case_data = await engine.get_case_stage(case_id, user["id"])
        return case_data
    except Exception as e:
        logger.error(f"Failed to get clinical case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clinical/cases/{case_id}/steps")
async def submit_reasoning_step(
    case_id: str,
    request: SubmitReasoningStepRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submit a clinical reasoning step for evaluation
    
    Evaluates the user's reasoning and provides feedback.
    May advance the case to the next stage based on performance.
    """
    try:
        engine = get_clinical_reasoning_engine(supabase)
        result = await engine.submit_reasoning_step(
            case_id=case_id,
            user_id=user["id"],
            step_type=request.step_type,
            user_input=request.user_input,
            notes=request.notes
        )
        return result
    except Exception as e:
        logger.error(f"Failed to submit reasoning step: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clinical/cases/{case_id}/advance")
async def advance_case_stage(
    case_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Advance the case to the next stage"""
    try:
        # Get current case
        response = supabase.table("clinical_cases")\
            .select("current_stage, stages")\
            .eq("id", case_id)\
            .eq("user_id", user["id"])\
            .single()\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Case not found")
        
        current_stage = response.data.get("current_stage", 0)
        total_stages = len(response.data.get("stages", []))
        
        if current_stage >= total_stages - 1:
            raise HTTPException(status_code=400, detail="Case already at final stage")
        
        # Advance stage
        supabase.table("clinical_cases")\
            .update({"current_stage": current_stage + 1})\
            .eq("id", case_id)\
            .execute()
        
        engine = get_clinical_reasoning_engine(supabase)
        return await engine.get_case_stage(case_id, user["id"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to advance case stage: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clinical/cases/{case_id}/complete")
async def complete_clinical_case(
    case_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Complete a clinical case and get final feedback"""
    try:
        engine = get_clinical_reasoning_engine(supabase)
        result = await engine.complete_case(case_id, user["id"])
        return result
    except Exception as e:
        logger.error(f"Failed to complete clinical case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# OSCE Simulation Endpoints

@app.post("/api/clinical/osce", status_code=201)
async def create_osce_scenario(
    request: CreateOSCERequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a new OSCE examination scenario
    
    Generates a structured OSCE station with simulated patient
    and examiner interactions.
    """
    try:
        engine = get_clinical_reasoning_engine(supabase)
        scenario = await engine.create_osce_scenario(
            user_id=user["id"],
            scenario_type=request.scenario_type,
            specialty=request.specialty,
            difficulty=request.difficulty
        )
        return scenario
    except Exception as e:
        logger.error(f"Failed to create OSCE scenario: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clinical/osce")
async def get_osce_scenarios(
    status: Optional[str] = None,
    scenario_type: Optional[str] = None,
    limit: int = 20,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's OSCE scenarios with optional filters"""
    try:
        query = supabase.table("osce_scenarios")\
            .select("id, scenario_type, specialty, difficulty, status, candidate_instructions, created_at")\
            .eq("user_id", user["id"])\
            .order("created_at", desc=True)\
            .limit(limit)
        
        if status:
            query = query.eq("status", status)
        if scenario_type:
            query = query.eq("scenario_type", scenario_type)
        
        response = query.execute()
        return {"scenarios": response.data or [], "count": len(response.data or [])}
    except Exception as e:
        logger.error(f"Failed to get OSCE scenarios: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clinical/osce/{scenario_id}")
async def get_osce_scenario(
    scenario_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get a specific OSCE scenario"""
    try:
        response = supabase.table("osce_scenarios")\
            .select("*")\
            .eq("id", scenario_id)\
            .eq("user_id", user["id"])\
            .single()\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        # Remove examiner-only fields
        scenario = response.data
        scenario.pop("examiner_checklist", None)
        scenario.pop("expected_actions", None)
        
        return scenario
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get OSCE scenario: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clinical/osce/{scenario_id}/interact")
async def osce_interact(
    scenario_id: str,
    request: OSCEInteractionRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Interact with OSCE scenario (patient/examiner)
    
    Sends user action and receives simulated patient response
    with examiner assessment.
    """
    try:
        engine = get_clinical_reasoning_engine(supabase)
        response = await engine.osce_interaction(
            scenario_id=scenario_id,
            user_id=user["id"],
            user_action=request.user_action
        )
        return response
    except Exception as e:
        logger.error(f"Failed to process OSCE interaction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clinical/osce/{scenario_id}/complete")
async def complete_osce_scenario(
    scenario_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Complete an OSCE scenario and get performance feedback"""
    try:
        # Get scenario with full data
        response = supabase.table("osce_scenarios")\
            .select("*")\
            .eq("id", scenario_id)\
            .eq("user_id", user["id"])\
            .single()\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        scenario = response.data
        
        # Calculate score
        checklist = scenario.get("examiner_checklist", [])
        interaction_history = scenario.get("interaction_history", [])
        
        # Collect triggered items from all interactions
        triggered_items = set()
        for interaction in interaction_history:
            for item in interaction.get("checklist_items", []):
                triggered_items.add(item)
        
        total_points = sum(item.get("points", 1) for item in checklist)
        earned_points = 0
        completed_items = []
        missed_items = []
        
        for item in checklist:
            if item.get("item") in triggered_items:
                earned_points += item.get("points", 1)
                completed_items.append(item.get("item"))
            else:
                missed_items.append(item.get("item"))
        
        score = (earned_points / total_points * 100) if total_points > 0 else 0
        
        # Update scenario status
        from datetime import datetime, timezone
        supabase.table("osce_scenarios")\
            .update({
                "status": "completed",
                "time_completed": datetime.now(timezone.utc).isoformat(),
                "checklist_score": score
            })\
            .eq("id", scenario_id)\
            .execute()
        
        return {
            "scenario_id": scenario_id,
            "final_score": round(score, 1),
            "earned_points": earned_points,
            "total_points": total_points,
            "completed_items": completed_items,
            "missed_items": missed_items,
            "interaction_count": len(interaction_history),
            "expected_actions": scenario.get("expected_actions", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete OSCE scenario: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Clinical Performance Endpoints

@app.get("/api/clinical/performance")
async def get_clinical_performance(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's clinical performance summary"""
    try:
        engine = get_clinical_reasoning_engine(supabase)
        performance = await engine.get_performance_summary(user["id"])
        return performance
    except Exception as e:
        logger.error(f"Failed to get clinical performance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clinical/performance/history")
async def get_clinical_history(
    days: int = 30,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's clinical practice history"""
    try:
        from datetime import datetime, timedelta
        
        start_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        # Get cases
        cases_response = supabase.table("clinical_cases")\
            .select("id, specialty, difficulty, status, created_at")\
            .eq("user_id", user["id"])\
            .gte("created_at", start_date)\
            .order("created_at", desc=True)\
            .execute()
        
        # Get OSCE scenarios
        osce_response = supabase.table("osce_scenarios")\
            .select("id, scenario_type, difficulty, status, checklist_score, created_at")\
            .eq("user_id", user["id"])\
            .gte("created_at", start_date)\
            .order("created_at", desc=True)\
            .execute()
        
        # Get reasoning steps
        steps_response = supabase.table("clinical_reasoning_steps")\
            .select("step_type, score, created_at")\
            .eq("user_id", user["id"])\
            .gte("created_at", start_date)\
            .execute()
        
        return {
            "cases": cases_response.data or [],
            "osce_scenarios": osce_response.data or [],
            "reasoning_steps": steps_response.data or [],
            "period_days": days
        }
    except Exception as e:
        logger.error(f"Failed to get clinical history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Run the application
if __name__ == "__main__":
    import uvicorn
    # Use string reference for app to enable reload
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
