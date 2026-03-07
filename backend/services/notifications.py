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
        self.webhook_url = os.getenv("WEBHOOK_URL")  # Discord
        self.telegram_webhook_url = os.getenv("TELEGRAM_WEBHOOK_URL")  # Telegram Bot
        
        # Check if notifications are enabled
        self.email_enabled = bool(self.smtp_user and self.smtp_password and self.admin_emails)
        self.webhook_enabled = bool(self.webhook_url)
        self.telegram_enabled = bool(self.telegram_webhook_url)
        
        if not self.email_enabled and not self.webhook_enabled and not self.telegram_enabled:
            logger.warning(
                "Notifications are not configured. Set SMTP_USER, SMTP_PASSWORD, and ADMIN_EMAILS "
                "for email notifications, WEBHOOK_URL for Discord, or TELEGRAM_WEBHOOK_URL for Telegram."
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
    
    def _format_discord_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format payload as Discord embed
        
        Args:
            payload: Original webhook payload
            
        Returns:
            Discord-formatted payload with embeds
        """
        event = payload.get("event", "notification")
        
        # Color codes for different event types
        colors = {
            "model_timeout": 0xF59E0B,  # Orange
            "api_key_failure": 0xEF4444,  # Red
            "fallback": 0x10B981,  # Green
            "maintenance_triggered": 0x8B5CF6,  # Purple
            "admin_override": 0x3B82F6  # Blue
        }
        
        color = colors.get(event, 0x6B7280)  # Default gray
        
        # Build embed based on event type
        if event == "model_timeout":
            embed = {
                "title": "🔴 Model Timeout Alert",
                "description": f"Model **{payload.get('model', 'Unknown')}** timed out",
                "color": color,
                "fields": [
                    {
                        "name": "Feature",
                        "value": payload.get("feature", "N/A"),
                        "inline": True
                    },
                    {
                        "name": "Provider",
                        "value": payload.get("provider", "N/A"),
                        "inline": True
                    },
                    {
                        "name": "Timeout Duration",
                        "value": f"{payload.get('timeout_seconds', 0)}s",
                        "inline": True
                    }
                ],
                "footer": {
                    "text": "VaidyaAI Monitoring"
                },
                "timestamp": payload.get("timestamp", datetime.utcnow().isoformat())
            }
        
        elif event == "api_key_failure":
            embed = {
                "title": "❌ API Key Failure",
                "description": f"API key failed for **{payload.get('provider')}/{payload.get('feature')}**",
                "color": color,
                "fields": [
                    {
                        "name": "Key ID",
                        "value": f"`{payload.get('key_id', 'N/A')[:8]}...`",
                        "inline": True
                    },
                    {
                        "name": "Provider",
                        "value": payload.get("provider", "N/A"),
                        "inline": True
                    },
                    {
                        "name": "Feature",
                        "value": payload.get("feature", "N/A"),
                        "inline": True
                    },
                    {
                        "name": "Error",
                        "value": f"```{payload.get('error', 'Unknown error')[:200]}```",
                        "inline": False
                    }
                ],
                "footer": {
                    "text": "VaidyaAI Monitoring"
                },
                "timestamp": payload.get("timestamp", datetime.utcnow().isoformat())
            }
        
        elif event == "fallback":
            embed = {
                "title": "🔄 Fallback Triggered",
                "description": f"Switched from **{payload.get('from_key_id')}** to **{payload.get('to_key_id')}**",
                "color": color,
                "fields": [
                    {
                        "name": "Provider",
                        "value": payload.get("provider", "N/A"),
                        "inline": True
                    },
                    {
                        "name": "Feature",
                        "value": payload.get("feature", "N/A"),
                        "inline": True
                    }
                ],
                "footer": {
                    "text": "VaidyaAI Monitoring"
                },
                "timestamp": payload.get("timestamp", datetime.utcnow().isoformat())
            }
        
        else:
            # Generic format for other events
            embed = {
                "title": f"📢 {event.replace('_', ' ').title()}",
                "description": "System notification",
                "color": color,
                "fields": [
                    {
                        "name": key.replace("_", " ").title(),
                        "value": str(value)[:1024],
                        "inline": True
                    }
                    for key, value in payload.items()
                    if key not in ["event", "timestamp"] and not key.startswith("_")
                ],
                "footer": {
                    "text": "VaidyaAI Monitoring"
                },
                "timestamp": payload.get("timestamp", datetime.utcnow().isoformat())
            }
        
        return {
            "embeds": [embed]
        }
    
    async def send_all_webhooks(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send notification to all configured webhooks (Discord + Telegram)
        
        Args:
            payload: Notification payload
            
        Returns:
            Dict with results from each webhook
        """
        results = {}
        
        # Send to Discord
        if self.webhook_enabled:
            discord_result = await self.send_webhook(self.webhook_url, payload)
            results["discord"] = discord_result
            logger.info(f"Discord webhook result: {discord_result.get('success')}")
        
        # Send to Telegram (don't format as Discord embed)
        if self.telegram_enabled:
            telegram_result = await self.send_webhook(self.telegram_webhook_url, payload, format_discord=False)
            results["telegram"] = telegram_result
            logger.info(f"Telegram webhook result: {telegram_result.get('success')}")
        
        return results
    
    async def send_webhook(self, url: str, payload: Dict[str, Any], format_discord: bool = True) -> Dict[str, Any]:
        """
        Send a webhook notification
        
        Automatically formats for Discord if URL is a Discord webhook and format_discord is True.
        
        Args:
            url: Webhook URL
            payload: JSON payload to send
            format_discord: Whether to format as Discord embed (default True)
            
        Returns:
            Dict with success status and message
            
        Requirements: 18.6
        """
        try:
            # Check if this is a Discord webhook and format accordingly
            if format_discord and "discord.com/api/webhooks" in url:
                payload = self._format_discord_webhook(payload)
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status >= 200 and response.status < 300:
                        logger.info(f"Webhook sent successfully to {url[:50]}...")
                        return {
                            "success": True,
                            "message": f"Webhook sent",
                            "status_code": response.status
                        }
                    else:
                        response_text = await response.text()
                        logger.warning(
                            f"Webhook returned non-success status {response.status}: {response_text[:200]}"
                        )
                        return {
                            "success": False,
                            "message": f"Webhook returned status {response.status}",
                            "status_code": response.status,
                            "response": response_text[:200]
                        }
        
        except Exception as e:
            logger.error(f"Failed to send webhook to {url[:50]}...: {str(e)}")
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
            "webhook_results": None
        }
        
        # Send emails to all admins
        if self.email_enabled:
            for admin_email in self.admin_emails:
                result = await self.send_email(admin_email, subject, body)
                results["email_results"].append({
                    "to": admin_email,
                    "success": result["success"]
                })
        
        # Send webhook to both Discord and Telegram
        if self.webhook_enabled or self.telegram_enabled:
            results["webhook_results"] = await self.send_all_webhooks(webhook_payload)
        
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
            "webhook_results": None
        }
        
        # Send emails to all admins
        if self.email_enabled:
            for admin_email in self.admin_emails:
                result = await self.send_email(admin_email, subject, body)
                results["email_results"].append({
                    "to": admin_email,
                    "success": result["success"]
                })
        
        # Send webhook to both Discord and Telegram
        if self.webhook_enabled or self.telegram_enabled:
            results["webhook_results"] = await self.send_all_webhooks(webhook_payload)
        
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
            "webhook_results": None
        }
        
        # Send emails to all admins
        if self.email_enabled:
            for admin_email in self.admin_emails:
                result = await self.send_email(admin_email, subject, body)
                results["email_results"].append({
                    "to": admin_email,
                    "success": result["success"]
                })
        
        # Send webhook to both Discord and Telegram
        if self.webhook_enabled or self.telegram_enabled:
            results["webhook_results"] = await self.send_all_webhooks(webhook_payload)
        
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
            "webhook_results": None
        }
        
        # Send emails to all admins (except the one who performed the action)
        if self.email_enabled:
            for admin_email in self.admin_emails:
                result = await self.send_email(admin_email, subject, body)
                results["email_results"].append({
                    "to": admin_email,
                    "success": result["success"]
                })
        
        # Send webhook to both Discord and Telegram
        if self.webhook_enabled or self.telegram_enabled:
            results["webhook_results"] = await self.send_all_webhooks(webhook_payload)
        
        return results
    
    async def notify_model_timeout(
        self,
        feature: str,
        model: str,
        timeout_seconds: int,
        provider: str = "huggingface"
    ) -> Dict[str, Any]:
        """
        Notify admins when a model times out
        
        Args:
            feature: Feature name (clinical, chat, etc.)
            model: Model name that timed out
            timeout_seconds: Timeout duration in seconds
            provider: Provider name
            
        Returns:
            Dict with notification results
        """
        subject = f"[Medical AI Platform] Model Timeout: {feature}"
        
        body = f"""
        <html>
        <body>
        <h2>Model Timeout Alert</h2>
        <p>A model request has timed out, indicating potential cold start or performance issues.</p>
        
        <h3>Details:</h3>
        <ul>
            <li><strong>Feature:</strong> {feature}</li>
            <li><strong>Model:</strong> {model}</li>
            <li><strong>Provider:</strong> {provider}</li>
            <li><strong>Timeout Duration:</strong> {timeout_seconds} seconds</li>
            <li><strong>Time:</strong> {datetime.utcnow().isoformat()}</li>
        </ul>
        
        <h3>Possible Causes:</h3>
        <ul>
            <li>Model cold start (first request after inactivity)</li>
            <li>Model server overload</li>
            <li>Network connectivity issues</li>
            <li>Model unavailability</li>
        </ul>
        
        <p><strong>User Impact:</strong> Users are seeing "Please try again later" messages.</p>
        <p>Consider monitoring the model's availability or switching to alternative models if this persists.</p>
        </body>
        </html>
        """
        
        # Prepare webhook payload
        webhook_payload = {
            "event": "model_timeout",
            "feature": feature,
            "model": model,
            "provider": provider,
            "timeout_seconds": timeout_seconds,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        results = {
            "email_results": [],
            "webhook_results": None
        }
        
        # Send emails to all admins
        if self.email_enabled:
            for admin_email in self.admin_emails:
                result = await self.send_email(admin_email, subject, body)
                results["email_results"].append({
                    "to": admin_email,
                    "success": result["success"]
                })
        
        # Send webhook to both Discord and Telegram
        if self.webhook_enabled or self.telegram_enabled:
            results["webhook_results"] = await self.send_all_webhooks(webhook_payload)
        
        return results


# Singleton instance
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """Get or create notification service instance"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
