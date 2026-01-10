"""
Admin Service
Handles administrative operations for user management and API key management

Requirements: 13.1, 13.3, 13.4, 13.5, 14.2, 14.4, 14.6, 14.7
"""
import os
from typing import Optional, Dict, Any, List
from datetime import date, datetime
from supabase import Client, create_client
from dotenv import load_dotenv
from services.audit import get_audit_service
from services.encryption import get_encryption_service

# Load environment variables
load_dotenv()


class AdminService:
    """Service for administrative user management operations"""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize admin service
        
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
        
        self.audit_service = get_audit_service(supabase_client)
        self.encryption_service = get_encryption_service()
    
    async def list_users(
        self,
        plan: Optional[str] = None,
        role: Optional[str] = None,
        disabled: Optional[bool] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        List users with optional filtering
        
        Args:
            plan: Optional filter by plan (free, student, pro, admin)
            role: Optional filter by role
            disabled: Optional filter by disabled status
            limit: Maximum number of users to return (default 100)
            
        Returns:
            List of user dictionaries
            
        Raises:
            Exception: If retrieval fails
            
        Requirements: 13.1
        """
        try:
            query = self.supabase.table("users").select("*")
            
            # Apply filters if provided
            if plan:
                query = query.eq("plan", plan)
            if role:
                query = query.eq("role", role)
            if disabled is not None:
                query = query.eq("disabled", disabled)
            
            # Order by created_at descending and limit results
            query = query.order("created_at", desc=True).limit(limit)
            
            response = query.execute()
            
            return response.data if response.data else []
        except Exception as e:
            raise Exception(f"Failed to list users: {str(e)}")
    
    async def update_user_plan(
        self,
        admin_id: str,
        user_id: str,
        new_plan: str
    ) -> Dict[str, Any]:
        """
        Update a user's plan with audit logging
        
        Args:
            admin_id: ID of the admin performing the action
            user_id: ID of the user to update
            new_plan: New plan to assign (free, student, pro, admin)
            
        Returns:
            Updated user data
            
        Raises:
            Exception: If update fails
            
        Requirements: 13.3
        """
        try:
            # Validate plan
            valid_plans = ['free', 'student', 'pro', 'admin']
            if new_plan not in valid_plans:
                raise Exception(f"Invalid plan: {new_plan}. Must be one of {valid_plans}")
            
            # Get current plan for audit log
            user_response = self.supabase.table("users").select("plan").eq("id", user_id).execute()
            
            if not user_response.data or len(user_response.data) == 0:
                raise Exception("User not found")
            
            old_plan = user_response.data[0]["plan"]
            
            # Update user plan
            update_response = self.supabase.table("users")\
                .update({"plan": new_plan})\
                .eq("id", user_id)\
                .execute()
            
            if not update_response.data or len(update_response.data) == 0:
                raise Exception("Failed to update user plan")
            
            # Log admin action
            await self.audit_service.log_admin_action(
                admin_id=admin_id,
                action_type="update_plan",
                target_type="user",
                target_id=user_id,
                details={
                    "old_plan": old_plan,
                    "new_plan": new_plan
                }
            )
            
            return update_response.data[0]
        except Exception as e:
            raise Exception(f"Failed to update user plan: {str(e)}")
    
    async def reset_user_usage(
        self,
        admin_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Reset a user's usage counters with audit logging
        
        Args:
            admin_id: ID of the admin performing the action
            user_id: ID of the user whose usage to reset
            
        Returns:
            Result of the reset operation
            
        Raises:
            Exception: If reset fails
            
        Requirements: 13.4
        """
        try:
            # Get today's date
            today = date.today()
            
            # Get current usage for audit log
            usage_response = self.supabase.table("usage_counters")\
                .select("*")\
                .eq("user_id", user_id)\
                .eq("date", str(today))\
                .execute()
            
            old_usage = usage_response.data[0] if usage_response.data else None
            
            # Reset usage counters for today
            reset_data = {
                "tokens_used": 0,
                "requests_count": 0,
                "pdf_uploads": 0,
                "mcqs_generated": 0,
                "images_used": 0,
                "flashcards_generated": 0
            }
            
            if old_usage:
                # Update existing counter
                update_response = self.supabase.table("usage_counters")\
                    .update(reset_data)\
                    .eq("user_id", user_id)\
                    .eq("date", str(today))\
                    .execute()
                
                result = update_response.data[0] if update_response.data else None
            else:
                # Create new counter with zeros
                reset_data["user_id"] = user_id
                reset_data["date"] = str(today)
                
                insert_response = self.supabase.table("usage_counters")\
                    .insert(reset_data)\
                    .execute()
                
                result = insert_response.data[0] if insert_response.data else None
            
            # Log admin action
            await self.audit_service.log_admin_action(
                admin_id=admin_id,
                action_type="reset_usage",
                target_type="user",
                target_id=user_id,
                details={
                    "date": str(today),
                    "old_usage": old_usage
                }
            )
            
            return {
                "user_id": user_id,
                "date": str(today),
                "reset": True,
                "usage": result
            }
        except Exception as e:
            raise Exception(f"Failed to reset user usage: {str(e)}")
    
    async def disable_user(
        self,
        admin_id: str,
        user_id: str,
        disabled: bool = True
    ) -> Dict[str, Any]:
        """
        Disable or enable a user account with audit logging
        
        Args:
            admin_id: ID of the admin performing the action
            user_id: ID of the user to disable/enable
            disabled: True to disable, False to enable (default True)
            
        Returns:
            Updated user data
            
        Raises:
            Exception: If update fails
            
        Requirements: 13.5
        """
        try:
            # Get current disabled status for audit log
            user_response = self.supabase.table("users").select("disabled").eq("id", user_id).execute()
            
            if not user_response.data or len(user_response.data) == 0:
                raise Exception("User not found")
            
            old_disabled = user_response.data[0]["disabled"]
            
            # Update user disabled status
            update_response = self.supabase.table("users")\
                .update({"disabled": disabled})\
                .eq("id", user_id)\
                .execute()
            
            if not update_response.data or len(update_response.data) == 0:
                raise Exception("Failed to update user disabled status")
            
            # Log admin action
            action_type = "disable_user" if disabled else "enable_user"
            await self.audit_service.log_admin_action(
                admin_id=admin_id,
                action_type=action_type,
                target_type="user",
                target_id=user_id,
                details={
                    "old_disabled": old_disabled,
                    "new_disabled": disabled
                }
            )
            
            return update_response.data[0]
        except Exception as e:
            raise Exception(f"Failed to disable/enable user: {str(e)}")
    
    # API Key Management Functions
    
    async def add_api_key(
        self,
        admin_id: str,
        provider: str,
        feature: str,
        key: str,
        priority: int = 0,
        status: str = "active"
    ) -> Dict[str, Any]:
        """
        Add a new API key with encryption and audit logging
        
        Args:
            admin_id: ID of the admin performing the action
            provider: Provider name (e.g., 'gemini', 'openai')
            feature: Feature name (e.g., 'chat', 'flashcard')
            key: Plaintext API key to encrypt and store
            priority: Priority level (higher = preferred, default 0)
            status: Initial status (active, degraded, disabled, default 'active')
            
        Returns:
            Created API key data (with encrypted key)
            
        Raises:
            Exception: If creation fails
            
        Requirements: 14.2
        """
        try:
            # Validate status
            valid_statuses = ['active', 'degraded', 'disabled']
            if status not in valid_statuses:
                raise Exception(f"Invalid status: {status}. Must be one of {valid_statuses}")
            
            # Encrypt the API key
            encrypted_key = self.encryption_service.encrypt_key(key)
            
            # Insert into database
            key_data = {
                "provider": provider,
                "feature": feature,
                "key_value": encrypted_key,
                "priority": priority,
                "status": status,
                "failure_count": 0,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            insert_response = self.supabase.table("api_keys")\
                .insert(key_data)\
                .execute()
            
            if not insert_response.data or len(insert_response.data) == 0:
                raise Exception("Failed to insert API key")
            
            created_key = insert_response.data[0]
            
            # Log admin action
            await self.audit_service.log_admin_action(
                admin_id=admin_id,
                action_type="add_api_key",
                target_type="api_key",
                target_id=created_key["id"],
                details={
                    "provider": provider,
                    "feature": feature,
                    "priority": priority,
                    "status": status
                }
            )
            
            return created_key
        except Exception as e:
            raise Exception(f"Failed to add API key: {str(e)}")
    
    async def list_api_keys(self) -> List[Dict[str, Any]]:
        """
        List all API keys (with encrypted key values)
        
        Returns:
            List of API key dictionaries
            
        Raises:
            Exception: If retrieval fails
            
        Requirements: 14.2
        """
        try:
            response = self.supabase.table("api_keys")\
                .select("*")\
                .order("priority", desc=True)\
                .order("created_at", desc=True)\
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            raise Exception(f"Failed to list API keys: {str(e)}")
    
    async def update_key_status(
        self,
        admin_id: str,
        key_id: str,
        status: str,
        priority: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Update an API key's status and/or priority with audit logging
        
        Args:
            admin_id: ID of the admin performing the action
            key_id: ID of the API key to update
            status: New status (active, degraded, disabled)
            priority: Optional new priority level
            
        Returns:
            Updated API key data
            
        Raises:
            Exception: If update fails
            
        Requirements: 14.4
        """
        try:
            # Validate status
            valid_statuses = ['active', 'degraded', 'disabled']
            if status not in valid_statuses:
                raise Exception(f"Invalid status: {status}. Must be one of {valid_statuses}")
            
            # Get current status for audit log
            key_response = self.supabase.table("api_keys")\
                .select("status, priority, provider, feature")\
                .eq("id", key_id)\
                .execute()
            
            if not key_response.data or len(key_response.data) == 0:
                raise Exception("API key not found")
            
            old_status = key_response.data[0]["status"]
            old_priority = key_response.data[0]["priority"]
            provider = key_response.data[0]["provider"]
            feature = key_response.data[0]["feature"]
            
            # Build update data
            update_data = {
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Add priority if provided
            if priority is not None:
                update_data["priority"] = priority
            
            # Update key status and/or priority
            update_response = self.supabase.table("api_keys")\
                .update(update_data)\
                .eq("id", key_id)\
                .execute()
            
            if not update_response.data or len(update_response.data) == 0:
                raise Exception("Failed to update API key")
            
            # Build audit details
            audit_details = {
                "provider": provider,
                "feature": feature,
                "old_status": old_status,
                "new_status": status
            }
            
            if priority is not None:
                audit_details["old_priority"] = old_priority
                audit_details["new_priority"] = priority
            
            # Log admin action
            await self.audit_service.log_admin_action(
                admin_id=admin_id,
                action_type="update_key_status",
                target_type="api_key",
                target_id=key_id,
                details=audit_details
            )
            
            return update_response.data[0]
        except Exception as e:
            raise Exception(f"Failed to update API key: {str(e)}")
    
    async def delete_api_key(
        self,
        admin_id: str,
        key_id: str
    ) -> Dict[str, Any]:
        """
        Delete an API key with audit logging
        
        Args:
            admin_id: ID of the admin performing the action
            key_id: ID of the API key to delete
            
        Returns:
            Result of the deletion
            
        Raises:
            Exception: If deletion fails
            
        Requirements: 14.6
        """
        try:
            # Get key info for audit log before deletion
            key_response = self.supabase.table("api_keys")\
                .select("provider, feature, status")\
                .eq("id", key_id)\
                .execute()
            
            if not key_response.data or len(key_response.data) == 0:
                raise Exception("API key not found")
            
            key_info = key_response.data[0]
            
            # Delete the key
            delete_response = self.supabase.table("api_keys")\
                .delete()\
                .eq("id", key_id)\
                .execute()
            
            # Log admin action
            await self.audit_service.log_admin_action(
                admin_id=admin_id,
                action_type="delete_api_key",
                target_type="api_key",
                target_id=key_id,
                details={
                    "provider": key_info["provider"],
                    "feature": key_info["feature"],
                    "status": key_info["status"]
                }
            )
            
            return {
                "deleted": True,
                "key_id": key_id
            }
        except Exception as e:
            raise Exception(f"Failed to delete API key: {str(e)}")
    
    async def test_api_key(
        self,
        key: str,
        provider: str
    ) -> Dict[str, Any]:
        """
        Test an API key by making a minimal test call
        
        Args:
            key: Plaintext API key to test
            provider: Provider name (e.g., 'gemini', 'openai')
            
        Returns:
            Test result with success status and message
            
        Raises:
            Exception: If test fails
            
        Requirements: 14.7
        """
        try:
            # For now, just validate that the key is not empty
            # In a full implementation, this would make actual API calls
            if not key or len(key) < 10:
                return {
                    "valid": False,
                    "message": "API key appears to be invalid (too short)"
                }
            
            # Basic format validation based on provider
            if provider == "gemini":
                if not key.startswith("AI"):
                    return {
                        "valid": False,
                        "message": "Gemini API keys typically start with 'AI'"
                    }
            elif provider == "openai":
                if not key.startswith("sk-"):
                    return {
                        "valid": False,
                        "message": "OpenAI API keys typically start with 'sk-'"
                    }
            
            # If basic validation passes, return success
            # In production, this would make a minimal test API call
            return {
                "valid": True,
                "message": "API key format appears valid (full test not implemented)"
            }
        except Exception as e:
            return {
                "valid": False,
                "message": f"Validation error: {str(e)}"
            }
    
    async def toggle_feature(
        self,
        admin_id: str,
        feature: str,
        enabled: bool
    ) -> Dict[str, Any]:
        """
        Toggle a feature on or off globally
        
        Args:
            admin_id: ID of the admin performing the action
            feature: Feature name to toggle
            enabled: True to enable, False to disable
            
        Returns:
            Dict with feature status
            
        Requirements: 16.2, 16.4
        """
        try:
            # Create flag name
            flag_name = f"feature_{feature}_enabled"
            
            # Check if flag exists
            existing_flag = self.supabase.table("system_flags") \
                .select("id") \
                .eq("flag_name", flag_name) \
                .execute()
            
            if existing_flag.data:
                # Update existing flag
                self.supabase.table("system_flags") \
                    .update({
                        "flag_value": str(enabled),
                        "updated_at": datetime.now().isoformat(),
                        "updated_by": admin_id
                    }) \
                    .eq("flag_name", flag_name) \
                    .execute()
            else:
                # Insert new flag
                self.supabase.table("system_flags") \
                    .insert({
                        "flag_name": flag_name,
                        "flag_value": str(enabled),
                        "updated_by": admin_id,
                        "updated_at": datetime.now().isoformat()
                    }) \
                    .execute()
            
            # Log the action (Requirement 16.4)
            await self.audit_service.log_admin_action(
                admin_id=admin_id,
                action_type="toggle_feature",
                target_type="feature",
                target_id=feature,
                details={
                    "feature": feature,
                    "enabled": enabled
                }
            )
            
            return {
                "feature": feature,
                "enabled": enabled,
                "message": f"Feature '{feature}' {'enabled' if enabled else 'disabled'} successfully"
            }
        except Exception as e:
            raise Exception(f"Failed to toggle feature: {str(e)}")
    
    async def get_feature_status(self) -> Dict[str, bool]:
        """
        Get the status of all feature toggles
        
        Returns:
            Dict mapping feature names to their enabled status
            
        Requirements: 16.2, 16.4
        """
        try:
            # Get all feature flags
            flags_result = self.supabase.table("system_flags") \
                .select("flag_name, flag_value") \
                .like("flag_name", "feature_%_enabled") \
                .execute()
            
            feature_status = {}
            
            if flags_result.data:
                for flag in flags_result.data:
                    # Extract feature name from flag_name (remove "feature_" prefix and "_enabled" suffix)
                    feature_name = flag["flag_name"].replace("feature_", "").replace("_enabled", "")
                    
                    # Parse flag value
                    enabled = flag["flag_value"].lower() == "true"
                    
                    feature_status[feature_name] = enabled
            
            # Add default features if not present
            default_features = ["chat", "flashcard", "mcq", "highyield", "explain", "map", "image", "pdf"]
            for feature in default_features:
                if feature not in feature_status:
                    feature_status[feature] = True  # Default to enabled
            
            return feature_status
        except Exception as e:
            raise Exception(f"Failed to get feature status: {str(e)}")
            
    async def get_system_flag(self, flag_name: str, default_value: str = "") -> str:
        """
        Get a system flag value
        """
        try:
            result = self.supabase.table("system_flags") \
                .select("flag_value") \
                .eq("flag_name", flag_name) \
                .execute()
            
            if result.data:
                return result.data[0]["flag_value"]
            return default_value
        except Exception:
            return default_value

    async def set_system_flag(self, admin_id: str, flag_name: str, flag_value: str) -> Dict[str, Any]:
        """
        Set a system flag value
        """
        try:
            # Check if flag exists
            existing_flag = self.supabase.table("system_flags") \
                .select("id") \
                .eq("flag_name", flag_name) \
                .execute()
            
            if existing_flag.data:
                # Update existing flag
                self.supabase.table("system_flags") \
                    .update({
                        "flag_value": flag_value,
                        "updated_at": datetime.now().isoformat(),
                        "updated_by": admin_id
                    }) \
                    .eq("flag_name", flag_name) \
                    .execute()
            else:
                # Insert new flag
                self.supabase.table("system_flags") \
                    .insert({
                        "flag_name": flag_name,
                        "flag_value": flag_value,
                        "updated_by": admin_id,
                        "updated_at": datetime.now().isoformat()
                    }) \
                    .execute()
            
            # Log the action
            await self.audit_service.log_admin_action(
                admin_id=admin_id,
                action_type="set_system_flag",
                target_type="flag",
                target_id=flag_name,
                details={
                    "flag_name": flag_name,
                    "flag_value": flag_value
                }
            )
            
            return {"flag_name": flag_name, "flag_value": flag_value}
        except Exception as e:
            raise Exception(f"Failed to set system flag: {str(e)}")
    
    async def get_audit_logs(
        self,
        limit: int = 100,
        admin_id: Optional[str] = None,
        action: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get audit logs with optional filtering
        
        Args:
            limit: Maximum number of logs to return (default 100)
            admin_id: Optional filter by admin ID
            action: Optional filter by action type
            
        Returns:
            List of audit log entries
            
        Raises:
            Exception: If retrieval fails
        """
        try:
            query = self.supabase.table("audit_logs").select("*")
            
            # Apply filters if provided
            if admin_id:
                query = query.eq("admin_id", admin_id)
            if action:
                query = query.eq("action", action)
            
            # Order by created_at descending and limit results
            query = query.order("created_at", desc=True).limit(limit)
            
            response = query.execute()
            
            return response.data if response.data else []
        except Exception as e:
            raise Exception(f"Failed to get audit logs: {str(e)}")


# Singleton instance
_admin_service_instance = None


def get_admin_service(supabase_client: Optional[Client] = None) -> AdminService:
    """
    Get or create admin service singleton instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        
    Returns:
        AdminService instance
    """
    global _admin_service_instance
    if _admin_service_instance is None or supabase_client is not None:
        _admin_service_instance = AdminService(supabase_client)
    return _admin_service_instance
