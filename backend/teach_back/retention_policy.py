"""
Data retention policy enforcement for teach-back sessions.

Automatically cleans up old session data based on user's plan retention policy.
Preserves summary statistics after detail deletion.
"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional
import asyncio

logger = logging.getLogger(__name__)


class RetentionPolicyEnforcer:
    """
    Enforces data retention policies for teach-back sessions.
    
    Responsibilities:
    - Load retention policies from configuration
    - Delete old session data based on user's plan
    - Preserve summary statistics
    - Log all deletions for audit
    - Apply new policies when user plan changes
    """
    
    def __init__(self, config_path: str = "backend/config/teach_back_retention.json"):
        """
        Initialize retention policy enforcer.
        
        Args:
            config_path: Path to retention configuration file
        """
        self.config_path = config_path
        self.policies = self._load_policies()
        logger.info("RetentionPolicyEnforcer initialized")
    
    def _load_policies(self) -> Dict[str, Any]:
        """Load retention policies from configuration file."""
        try:
            config_file = Path(self.config_path)
            if not config_file.exists():
                logger.warning(f"Retention config not found: {self.config_path}, using defaults")
                return self._get_default_policies()
            
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            logger.info(f"Loaded retention policies from {self.config_path}")
            return config
        except Exception as e:
            logger.error(f"Failed to load retention policies: {str(e)}")
            return self._get_default_policies()
    
    def _get_default_policies(self) -> Dict[str, Any]:
        """Get default retention policies."""
        return {
            "retention_policies": {
                "free": {"days": 7},
                "student": {"days": 30},
                "pro": {"days": 90},
                "admin": {"days": 365}
            },
            "preserve_summaries": True,
            "log_deletions": True
        }
    
    def get_retention_days(self, plan: str) -> int:
        """
        Get retention days for a plan.
        
        Args:
            plan: User's subscription plan
            
        Returns:
            Number of days to retain data
        """
        policies = self.policies.get("retention_policies", {})
        plan_policy = policies.get(plan.lower(), policies.get("free", {"days": 7}))
        return plan_policy.get("days", 7)
    
    async def cleanup_old_sessions(self, db_connection) -> Dict[str, int]:
        """
        Clean up old session data based on retention policies.
        
        Args:
            db_connection: Database connection
            
        Returns:
            Dictionary with cleanup statistics
        """
        try:
            stats = {
                "sessions_deleted": 0,
                "transcripts_deleted": 0,
                "errors_deleted": 0,
                "examinations_deleted": 0,
                "summaries_preserved": 0
            }
            
            # Get all users with their plans
            users_query = """
                SELECT id, plan FROM users
            """
            users = await db_connection.fetch(users_query)
            
            for user in users:
                user_id = user['id']
                plan = user['plan']
                retention_days = self.get_retention_days(plan)
                cutoff_date = datetime.now() - timedelta(days=retention_days)
                
                # Find old sessions
                old_sessions_query = """
                    SELECT id FROM teach_back_sessions
                    WHERE user_id = $1 AND started_at < $2
                """
                old_sessions = await db_connection.fetch(old_sessions_query, user_id, cutoff_date)
                
                for session in old_sessions:
                    session_id = session['id']
                    
                    # Delete transcripts
                    transcripts_deleted = await db_connection.execute(
                        "DELETE FROM teach_back_transcripts WHERE session_id = $1",
                        session_id
                    )
                    stats["transcripts_deleted"] += int(transcripts_deleted.split()[-1])
                    
                    # Delete errors
                    errors_deleted = await db_connection.execute(
                        "DELETE FROM teach_back_errors WHERE session_id = $1",
                        session_id
                    )
                    stats["errors_deleted"] += int(errors_deleted.split()[-1])
                    
                    # Delete examinations
                    examinations_deleted = await db_connection.execute(
                        "DELETE FROM teach_back_examinations WHERE session_id = $1",
                        session_id
                    )
                    stats["examinations_deleted"] += int(examinations_deleted.split()[-1])
                    
                    # Check if summary exists (preserve it)
                    summary_exists = await db_connection.fetchval(
                        "SELECT COUNT(*) FROM teach_back_summaries WHERE session_id = $1",
                        session_id
                    )
                    if summary_exists:
                        stats["summaries_preserved"] += 1
                    
                    # Delete session
                    await db_connection.execute(
                        "DELETE FROM teach_back_sessions WHERE id = $1",
                        session_id
                    )
                    stats["sessions_deleted"] += 1
                    
                    # Log deletion if enabled
                    if self.policies.get("log_deletions", True):
                        await self._log_deletion(db_connection, user_id, session_id, cutoff_date)
            
            logger.info(f"Cleanup completed: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
            raise
    
    async def _log_deletion(self, db_connection, user_id: str, session_id: str, cutoff_date: datetime):
        """Log session deletion for audit purposes."""
        try:
            log_query = """
                INSERT INTO audit_logs (user_id, action_type, target_type, target_id, details, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            """
            await db_connection.execute(
                log_query,
                user_id,
                "delete_old_session",
                "teach_back_session",
                session_id,
                json.dumps({"reason": "retention_policy", "cutoff_date": cutoff_date.isoformat()}),
                datetime.now()
            )
        except Exception as e:
            logger.warning(f"Failed to log deletion: {str(e)}")
    
    async def apply_new_retention_policy(self, db_connection, user_id: str, old_plan: str, new_plan: str):
        """
        Apply new retention policy when user plan changes.
        
        Args:
            db_connection: Database connection
            user_id: User ID
            old_plan: Previous plan
            new_plan: New plan
        """
        try:
            old_retention = self.get_retention_days(old_plan)
            new_retention = self.get_retention_days(new_plan)
            
            logger.info(f"User {user_id} plan changed: {old_plan} -> {new_plan}, retention: {old_retention} -> {new_retention} days")
            
            # If new retention is shorter, clean up immediately
            if new_retention < old_retention:
                cutoff_date = datetime.now() - timedelta(days=new_retention)
                
                old_sessions_query = """
                    SELECT id FROM teach_back_sessions
                    WHERE user_id = $1 AND started_at < $2
                """
                old_sessions = await db_connection.fetch(old_sessions_query, user_id, cutoff_date)
                
                for session in old_sessions:
                    session_id = session['id']
                    
                    # Delete details but preserve summary
                    await db_connection.execute(
                        "DELETE FROM teach_back_transcripts WHERE session_id = $1",
                        session_id
                    )
                    await db_connection.execute(
                        "DELETE FROM teach_back_errors WHERE session_id = $1",
                        session_id
                    )
                    await db_connection.execute(
                        "DELETE FROM teach_back_examinations WHERE session_id = $1",
                        session_id
                    )
                    await db_connection.execute(
                        "DELETE FROM teach_back_sessions WHERE id = $1",
                        session_id
                    )
                    
                    await self._log_deletion(db_connection, user_id, session_id, cutoff_date)
                
                logger.info(f"Applied new retention policy for user {user_id}: deleted {len(old_sessions)} old sessions")
        
        except Exception as e:
            logger.error(f"Error applying new retention policy: {str(e)}")
            raise


async def run_daily_cleanup():
    """
    Run daily cleanup job.
    
    This should be scheduled to run daily (e.g., via cron or scheduler).
    """
    from supabase import create_client
    import os
    
    try:
        # Initialize database connection
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        supabase = create_client(supabase_url, supabase_key)
        
        # Run cleanup
        enforcer = RetentionPolicyEnforcer()
        stats = await enforcer.cleanup_old_sessions(supabase)
        
        logger.info(f"Daily cleanup completed successfully: {stats}")
        
    except Exception as e:
        logger.error(f"Daily cleanup failed: {str(e)}")
        raise


if __name__ == "__main__":
    # Run cleanup when executed directly
    asyncio.run(run_daily_cleanup())
