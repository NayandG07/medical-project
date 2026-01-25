"""
Notification Service

Handles sending notifications to admins for critical system events.
Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
"""
import os
import logging
import smtplib
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
from datetime import datetime
import aiohttp
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending notifications to admins"""
    
    def __init__(self):
        """Initialize the notification service"""
        # Email configuration
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("FROM_EMAIL", self.smtp_user)
        
        # Admin notification recipients
        self.admin_emails = os.getenv("ADMIN_EMAILS", "").split(",")
        self.admin_emails = [email.strip() for email in self.admin_emails if email.strip()]
        
        # Webhook configuration
        self.webhook_url = os.getenv("WEBHOOK_URL")
        
        # Check if notifications are enabled
        self.email_enabled = bool(self.smtp_user and self.smtp_password and self.admin_emails)
        self.webhook_enabled = bool(self.webhook_url)
        
        if not self.email_enabled and not self.webhook_enabled:
            logger.warning(
                "Notifications are not configured. Set SMTP_USER, SMTP_PASSWORD, and ADMIN_EMAILS "
                "for email notifications, or WEBHOOK_URL for webhook notifications."
            )
    
    async def send_email(self, to: str, subject: str, body: str) -> Dict[str, Any]:
        """
        Send an email notification
        
        Args:
            to: Recipient email address
            subject: Email subject
            body: Email body (plain text or HTML)
            
        Returns:
            Dict with success status and message
            
        Requirements: 18.5
        """
        if not self.email_enabled:
            logger.warning("Email notifications not configured, skipping email send")
            return {
                "success": False,
                "message": "Email notifications not configured"
            }
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = to
            
            # Add body
            part = MIMEText(body, 'html' if '<html>' in body.lower() else 'plain')
            msg.attach(part)
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            # Mask email for logging
            from utils.logging_helpers import mask_email
            masked_to = mask_email(to)
            logger.info(f"Email sent successfully to {masked_to}: {subject}")
            return {
                "success": True,
                "message": f"Email sent to {masked_to}"
            }
            
        except Exception as e:
            # Mask email for logging
            from utils.logging_helpers import mask_email
            masked_to = mask_email(to)
            logger.error(f"Failed to send email to {masked_to}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to send email: {str(e)}"
            }
    
    async def send_webhook(self, url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a webhook notification
        
        Args:
            url: Webhook URL
            payload: JSON payload to send
            
        Returns:
            Dict with success status and message
            
        Requirements: 18.6
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status >= 200 and response.status < 300:
                        logger.info(f"Webhook sent successfully to {url}")
                        return {
                            "success": True,
                            "message": f"Webhook sent to {url}",
                            "status_code": response.status
                        }
                    else:
                        logger.warning(
                            f"Webhook returned non-success status {response.status}: {url}"
                        )
                        return {
                            "success": False,
                            "message": f"Webhook returned status {response.status}",
                            "status_code": response.status
                        }
        
        except Exception as e:
            logger.error(f"Failed to send webhook to {url}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to send webhook: {str(e)}"
            }
    
    async def notify_api_key_failure(
        self,
        key_id: str,
        error: str,
        provider: str,
        feature: str
    ) -> Dict[str, Any]:
        """
        Notify admins when an API key fails
        
        Args:
            key_id: API key ID that failed
            error: Error message
            provider: Provider name
            feature: Feature name
            
        Returns:
            Dict with notification results
            
        Requirements: 18.1
        """
        subject = f"[Medical AI Platform] API Key Failure: {provider}/{feature}"
        
        body = f"""
        <html>
        <body>
        <h2>API Key Failure Alert</h2>
        <p>An API key has failed and may need attention.</p>
        
        <h3>Details:</h3>
        <ul>
            <li><strong>Key ID:</strong> {key_id}</li>
            <li><strong>Provider:</strong> {provider}</li>
            <li><strong>Feature:</strong> {feature}</li>
            <li><strong>Error:</strong> {error}</li>
            <li><strong>Time:</strong> {datetime.utcnow().isoformat()}</li>
        </ul>
        
        <p>Please check the admin panel for more details and consider adding backup keys.</p>
        </body>
        </html>
        """
        
        # Prepare webhook payload
        webhook_payload = {
            "event": "api_key_failure",
            "key_id": key_id,
            "provider": provider,
            "feature": feature,
            "error": error,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        results = {
            "email_results": [],
            "webhook_result": None
        }
        
        # Send emails to all admins
        if self.email_enabled:
            for admin_email in self.admin_emails:
                result = await self.send_email(admin_email, subject, body)
                results["email_results"].append({
                    "to": admin_email,
                    "success": result["success"]
                })
        
        # Send webhook
        if self.webhook_enabled:
            results["webhook_result"] = await self.send_webhook(
                self.webhook_url,
                webhook_payload
            )
        
        return results
    
    async def notify_fallback(
        self,
        from_key_id: str,
        to_key_id: str,
        provider: str,
        feature: str
    ) -> Dict[str, Any]:
        """
        Notify admins when a fallback occurs
        
        Args:
            from_key_id: Key ID that failed
            to_key_id: Key ID being used as fallback
            provider: Provider name
            feature: Feature name
            
        Returns:
            Dict with notification results
            
        Requirements: 18.2
        """
        subject = f"[Medical AI Platform] Fallback Triggered: {provider}/{feature}"
        
        body = f"""
        <html>
        <body>
        <h2>API Key Fallback Alert</h2>
        <p>The system has automatically failed over to a backup API key.</p>
        
        <h3>Details:</h3>
        <ul>
            <li><strong>Failed Key:</strong> {from_key_id}</li>
            <li><strong>Fallback Key:</strong> {to_key_id}</li>
            <li><strong>Provider:</strong> {provider}</li>
            <li><strong>Feature:</strong> {feature}</li>
            <li><strong>Time:</strong> {datetime.utcnow().isoformat()}</li>
        </ul>
        
        <p>The primary key may need attention. Please check the admin panel.</p>
        </body>
        </html>
        """
        
        # Prepare webhook payload
        webhook_payload = {
            "event": "fallback",
            "from_key_id": from_key_id,
            "to_key_id": to_key_id,
            "provider": provider,
            "feature": feature,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        results = {
            "email_results": [],
            "webhook_result": None
        }
        
        # Send emails to all admins
        if self.email_enabled:
            for admin_email in self.admin_emails:
                result = await self.send_email(admin_email, subject, body)
                results["email_results"].append({
                    "to": admin_email,
                    "success": result["success"]
                })
        
        # Send webhook
        if self.webhook_enabled:
            results["webhook_result"] = await self.send_webhook(
                self.webhook_url,
                webhook_payload
            )
        
        return results
    
    async def notify_maintenance_triggered(
        self,
        level: str,
        reason: str,
        feature: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Notify admins when maintenance mode is triggered
        
        Args:
            level: Maintenance level (soft or hard)
            reason: Reason for maintenance
            feature: Optional feature that triggered maintenance
            
        Returns:
            Dict with notification results
            
        Requirements: 18.3
        """
        subject = f"[Medical AI Platform] URGENT: {level.upper()} Maintenance Mode Triggered"
        
        body = f"""
        <html>
        <body>
        <h2 style="color: red;">Maintenance Mode Alert</h2>
        <p><strong>The system has automatically entered {level} maintenance mode.</strong></p>
        
        <h3>Details:</h3>
        <ul>
            <li><strong>Level:</strong> {level}</li>
            <li><strong>Reason:</strong> {reason}</li>
            {f'<li><strong>Feature:</strong> {feature}</li>' if feature else ''}
            <li><strong>Time:</strong> {datetime.utcnow().isoformat()}</li>
        </ul>
        
        <h3>What this means:</h3>
        {'<p>Soft maintenance: Heavy features are paused, but chat and admin access remain available.</p>' if level == 'soft' else ''}
        {'<p>Hard maintenance: Only admin access is available. All user features are disabled.</p>' if level == 'hard' else ''}
        
        <p><strong>Action required:</strong> Please check the admin panel and resolve the underlying issue.</p>
        </body>
        </html>
        """
        
        # Prepare webhook payload
        webhook_payload = {
            "event": "maintenance_triggered",
            "level": level,
            "reason": reason,
            "feature": feature,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        results = {
            "email_results": [],
            "webhook_result": None
        }
        
        # Send emails to all admins
        if self.email_enabled:
            for admin_email in self.admin_emails:
                result = await self.send_email(admin_email, subject, body)
                results["email_results"].append({
                    "to": admin_email,
                    "success": result["success"]
                })
        
        # Send webhook
        if self.webhook_enabled:
            results["webhook_result"] = await self.send_webhook(
                self.webhook_url,
                webhook_payload
            )
        
        return results
    
    async def notify_admin_override(
        self,
        admin_id: str,
        action: str,
        details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Notify admins when another admin performs a critical override
        
        Args:
            admin_id: ID of admin who performed the action
            action: Action performed
            details: Optional additional details
            
        Returns:
            Dict with notification results
            
        Requirements: 18.4
        """
        subject = f"[Medical AI Platform] Admin Override: {action}"
        
        details_html = ""
        if details:
            details_html = "<h3>Additional Details:</h3><ul>"
            for key, value in details.items():
                details_html += f"<li><strong>{key}:</strong> {value}</li>"
            details_html += "</ul>"
        
        body = f"""
        <html>
        <body>
        <h2>Admin Override Notification</h2>
        <p>An admin has performed a critical system override.</p>
        
        <h3>Details:</h3>
        <ul>
            <li><strong>Admin ID:</strong> {admin_id}</li>
            <li><strong>Action:</strong> {action}</li>
            <li><strong>Time:</strong> {datetime.utcnow().isoformat()}</li>
        </ul>
        
        {details_html}
        
        <p>This notification is for awareness and audit purposes.</p>
        </body>
        </html>
        """
        
        # Prepare webhook payload
        webhook_payload = {
            "event": "admin_override",
            "admin_id": admin_id,
            "action": action,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        results = {
            "email_results": [],
            "webhook_result": None
        }
        
        # Send emails to all admins (except the one who performed the action)
        if self.email_enabled:
            for admin_email in self.admin_emails:
                result = await self.send_email(admin_email, subject, body)
                results["email_results"].append({
                    "to": admin_email,
                    "success": result["success"]
                })
        
        # Send webhook
        if self.webhook_enabled:
            results["webhook_result"] = await self.send_webhook(
                self.webhook_url,
                webhook_payload
            )
        
        return results


# Singleton instance
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """Get or create notification service instance"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
