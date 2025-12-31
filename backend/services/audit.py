"""
Audit Logging Service
Logs admin actions for compliance and security tracking

Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
"""
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from supabase import Client, create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class AuditService:
    """Service for logging admin actions"""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize audit service
        
        Args:
            supabase_client: Optional Supabase client for dependency injection
        """
        if supabase_client:
            self.supabase = supabase_client
        else:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
            self.supabase = create_client(supabase_url, supabase_key)
    
    async def log_admin_action(
        self,
        admin_id: str,
        action_type: str,
        target_type: str,
        target_id: str,
        details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Log an admin action to the audit_logs table
        
        Args:
            admin_id: ID of the admin performing the action
            action_type: Type of action (e.g., 'update_plan', 'reset_usage', 'disable_user')
            target_type: Type of target (e.g., 'user', 'api_key', 'system_flag')
            target_id: ID of the target entity
            details: Optional additional details about the action
            
        Returns:
            Dict containing the created audit log entry
            
        Raises:
            Exception: If logging fails
            
        Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
        """
        try:
            # Create audit log entry
            log_data = {
                "admin_id": admin_id,
                "action_type": action_type,
                "target_type": target_type,
                "target_id": target_id,
                "details": details
            }
            
            response = self.supabase.table("audit_logs").insert(log_data).execute()
            
            if not response.data or len(response.data) == 0:
                raise Exception("Failed to create audit log entry")
            
            return response.data[0]
        except Exception as e:
            # Log error but don't fail the admin action
            print(f"Audit logging error: {str(e)}")
            # Re-raise to ensure caller knows logging failed
            raise Exception(f"Failed to log admin action: {str(e)}")
    
    async def get_audit_logs(
        self,
        admin_id: Optional[str] = None,
        action_type: Optional[str] = None,
        target_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Retrieve audit logs with optional filtering
        
        Args:
            admin_id: Optional filter by admin ID
            action_type: Optional filter by action type
            target_type: Optional filter by target type
            limit: Maximum number of logs to return (default 100)
            
        Returns:
            List of audit log entries ordered by timestamp descending
            
        Raises:
            Exception: If retrieval fails
            
        Requirements: 19.6
        """
        try:
            query = self.supabase.table("audit_logs").select("*")
            
            # Apply filters if provided
            if admin_id:
                query = query.eq("admin_id", admin_id)
            if action_type:
                query = query.eq("action_type", action_type)
            if target_type:
                query = query.eq("target_type", target_type)
            
            # Order by created_at descending and limit results
            query = query.order("created_at", desc=True).limit(limit)
            
            response = query.execute()
            
            return response.data if response.data else []
        except Exception as e:
            raise Exception(f"Failed to retrieve audit logs: {str(e)}")


# Singleton instance
_audit_service_instance = None


def get_audit_service(supabase_client: Optional[Client] = None) -> AuditService:
    """
    Get or create audit service singleton instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        
    Returns:
        AuditService instance
    """
    global _audit_service_instance
    if _audit_service_instance is None or supabase_client is not None:
        _audit_service_instance = AuditService(supabase_client)
    return _audit_service_instance
