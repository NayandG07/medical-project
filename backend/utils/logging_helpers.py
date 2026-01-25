"""
Logging Helper Utilities
Provides safe logging functions that mask sensitive information
"""
import re
from typing import Any, Dict


def mask_email(email: str) -> str:
    """
    Mask email address for logging
    
    Example: user@example.com -> u***@example.com
    
    Args:
        email: Email address to mask
        
    Returns:
        Masked email address
    """
    if not email or '@' not in email:
        return "[invalid-email]"
    
    local, domain = email.split('@', 1)
    if len(local) <= 2:
        masked_local = local[0] + '*'
    else:
        masked_local = local[0] + '*' * (len(local) - 1)
    
    return f"{masked_local}@{domain}"


def mask_user_id(user_id: str, length: int = 8) -> str:
    """
    Mask user ID for logging by showing only first N characters
    
    Example: abc123def456 -> abc123de...
    
    Args:
        user_id: User ID to mask
        length: Number of characters to show (default: 8)
        
    Returns:
        Masked user ID
    """
    if not user_id:
        return "[no-id]"
    
    if len(user_id) <= length:
        return user_id
    
    return f"{user_id[:length]}..."


def safe_log_user(user: Dict[str, Any]) -> str:
    """
    Create a safe log string for user information
    
    Args:
        user: User dictionary with 'id' and optionally 'email'
        
    Returns:
        Safe string for logging (e.g., "User[abc123de...]")
    """
    if not user:
        return "User[unknown]"
    
    user_id = user.get('id', 'unknown')
    return f"User[{mask_user_id(user_id)}]"


def mask_sensitive_data(text: str) -> str:
    """
    Mask sensitive data patterns in text
    
    Masks:
    - Email addresses
    - API keys (patterns like sk-..., key_...)
    - UUIDs
    - Credit card numbers
    
    Args:
        text: Text that may contain sensitive data
        
    Returns:
        Text with sensitive data masked
    """
    if not text:
        return text
    
    # Mask email addresses
    text = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        lambda m: mask_email(m.group(0)),
        text
    )
    
    # Mask API keys (common patterns)
    text = re.sub(r'\b(sk|key|api|token)[-_][A-Za-z0-9]{20,}\b', '[API-KEY-MASKED]', text, flags=re.IGNORECASE)
    
    # Mask long UUIDs (keep first 8 chars)
    text = re.sub(
        r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b',
        lambda m: f"{m.group(0)[:8]}...",
        text,
        flags=re.IGNORECASE
    )
    
    # Mask credit card numbers
    text = re.sub(r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b', '[CARD-MASKED]', text)
    
    return text


def safe_log_dict(data: Dict[str, Any], sensitive_keys: list = None) -> Dict[str, Any]:
    """
    Create a safe copy of a dictionary for logging by masking sensitive keys
    
    Args:
        data: Dictionary to make safe
        sensitive_keys: List of keys to mask (default: common sensitive keys)
        
    Returns:
        Safe copy of dictionary with sensitive values masked
    """
    if sensitive_keys is None:
        sensitive_keys = [
            'password', 'token', 'api_key', 'secret', 'key',
            'authorization', 'auth', 'credential', 'email'
        ]
    
    safe_data = {}
    for key, value in data.items():
        # Check if key is sensitive
        is_sensitive = any(sensitive in key.lower() for sensitive in sensitive_keys)
        
        if is_sensitive:
            if isinstance(value, str):
                if '@' in value:
                    safe_data[key] = mask_email(value)
                elif len(value) > 8:
                    safe_data[key] = f"{value[:4]}...{value[-4:]}"
                else:
                    safe_data[key] = "[MASKED]"
            else:
                safe_data[key] = "[MASKED]"
        elif isinstance(value, dict):
            safe_data[key] = safe_log_dict(value, sensitive_keys)
        elif isinstance(value, list):
            safe_data[key] = [
                safe_log_dict(item, sensitive_keys) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            safe_data[key] = value
    
    return safe_data
