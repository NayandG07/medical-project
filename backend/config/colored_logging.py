"""
Colored Logging Configuration for FastAPI
Provides colorful console output for better readability in Git Bash

USAGE:
    In main.py:
        from config.colored_logging import setup_colored_logging, log_startup_banner
        setup_colored_logging(level=logging.INFO)
        log_startup_banner()

FEATURES:
    - Color-coded log levels (DEBUG=Cyan, INFO=Green, WARNING=Yellow, ERROR=Red, CRITICAL=Magenta)
    - Automatic HTTP status code coloring (2xx=Green, 3xx=Yellow, 4xx=Red, 5xx=Magenta)
    - Clean, readable format with timestamps and module names
    - Special formatting for Uvicorn access logs
    - Simple startup banner

TESTING:
    Run: python test_colored_logging.py

CUSTOMIZATION:
    Adjust colors by modifying the COLORS dictionary in ColoredFormatter class
    Change log level: setup_colored_logging(level=logging.DEBUG)
    Disable banner: Just don't call log_startup_banner()
"""
import logging
import sys
from datetime import datetime


class ColoredFormatter(logging.Formatter):
    """Custom formatter with ANSI color codes for terminal output"""
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
    }
    
    # Component colors
    TIMESTAMP_COLOR = '\033[90m'      # Bright Black (Gray)
    MODULE_COLOR = '\033[94m'         # Bright Blue
    FUNCTION_COLOR = '\033[96m'       # Bright Cyan
    RESET = '\033[0m'                 # Reset
    BOLD = '\033[1m'                  # Bold
    
    # Status code colors
    STATUS_SUCCESS = '\033[92m'       # Bright Green (2xx)
    STATUS_REDIRECT = '\033[93m'      # Bright Yellow (3xx)
    STATUS_CLIENT_ERROR = '\033[91m'  # Bright Red (4xx)
    STATUS_SERVER_ERROR = '\033[95m'  # Bright Magenta (5xx)
    
    def format(self, record):
        """Format log record with colors"""
        # Get level color
        level_color = self.COLORS.get(record.levelname, self.RESET)
        
        # Format timestamp
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        colored_timestamp = f"{self.TIMESTAMP_COLOR}{timestamp}{self.RESET}"
        
        # Format level name with color and padding
        colored_level = f"{level_color}{self.BOLD}{record.levelname:8}{self.RESET}"
        
        # Format module and function
        module_info = f"{self.MODULE_COLOR}{record.name}{self.RESET}"
        if hasattr(record, 'funcName') and record.funcName and record.funcName != '<module>':
            module_info += f"{self.TIMESTAMP_COLOR}.{self.RESET}{self.FUNCTION_COLOR}{record.funcName}{self.RESET}"
        
        # Format message
        message = record.getMessage()
        
        # Color HTTP status codes in messages
        message = self.colorize_status_codes(message)
        
        # Build final message
        log_message = f"{colored_timestamp} | {colored_level} | {module_info} | {message}"
        
        # Add exception info if present
        if record.exc_info:
            log_message += f"\n{self.formatException(record.exc_info)}"
        
        return log_message
    
    def colorize_status_codes(self, message):
        """Add colors to HTTP status codes in messages"""
        import re
        
        def colorize_code(match):
            code = int(match.group(1))
            if 200 <= code < 300:
                return f"{self.STATUS_SUCCESS}{match.group(0)}{self.RESET}"
            elif 300 <= code < 400:
                return f"{self.STATUS_REDIRECT}{match.group(0)}{self.RESET}"
            elif 400 <= code < 500:
                return f"{self.STATUS_CLIENT_ERROR}{match.group(0)}{self.RESET}"
            elif 500 <= code < 600:
                return f"{self.STATUS_SERVER_ERROR}{match.group(0)}{self.RESET}"
            return match.group(0)
        
        # Match status codes (e.g., "200", "404", "500")
        message = re.sub(r'\b([1-5]\d{2})\b', colorize_code, message)
        
        return message


class UvicornColoredFormatter(ColoredFormatter):
    """Special formatter for Uvicorn access logs"""
    
    REQUEST_METHOD_COLORS = {
        'GET': '\033[36m',      # Cyan
        'POST': '\033[32m',     # Green
        'PUT': '\033[33m',      # Yellow
        'DELETE': '\033[31m',   # Red
        'PATCH': '\033[35m',    # Magenta
        'OPTIONS': '\033[90m',  # Gray
        'HEAD': '\033[90m',     # Gray
    }
    
    def format(self, record):
        """Format Uvicorn access logs with colors"""
        message = record.getMessage()
        
        # Color HTTP methods
        for method, color in self.REQUEST_METHOD_COLORS.items():
            if f'"{method}' in message:
                message = message.replace(f'"{method}', f'"{color}{self.BOLD}{method}{self.RESET}')
        
        # Color paths (URLs)
        import re
        message = re.sub(
            r'(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+([^\s"]+)',
            lambda m: f"{m.group(1)} {self.FUNCTION_COLOR}{m.group(2)}{self.RESET}",
            message
        )
        
        # Update record message
        record.msg = message
        record.args = ()
        
        return super().format(record)


def setup_colored_logging(level=logging.INFO, show_banner=True):
    """
    Setup colored logging for the application
    
    Args:
        level: Logging level (default: INFO)
        show_banner: Whether to show startup banner (default: True)
    """
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    
    # Set colored formatter
    colored_formatter = ColoredFormatter()
    console_handler.setFormatter(colored_formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)
    
    # Configure Uvicorn loggers
    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_access.handlers.clear()
    uvicorn_access_handler = logging.StreamHandler(sys.stdout)
    uvicorn_access_handler.setFormatter(UvicornColoredFormatter())
    uvicorn_access.addHandler(uvicorn_access_handler)
    uvicorn_access.propagate = False
    
    uvicorn_error = logging.getLogger("uvicorn.error")
    uvicorn_error.handlers.clear()
    uvicorn_error_handler = logging.StreamHandler(sys.stdout)
    uvicorn_error_handler.setFormatter(ColoredFormatter())
    uvicorn_error.addHandler(uvicorn_error_handler)
    uvicorn_error.propagate = False
    
    # Configure FastAPI logger
    fastapi_logger = logging.getLogger("fastapi")
    fastapi_logger.handlers.clear()
    fastapi_handler = logging.StreamHandler(sys.stdout)
    fastapi_handler.setFormatter(ColoredFormatter())
    fastapi_logger.addHandler(fastapi_handler)
    fastapi_logger.propagate = False
    
    return root_logger


def log_startup_banner(host: str = "localhost", port: int = 8000):
    """Print a colorful startup banner"""
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RESET = '\033[0m'
    BOLD = '\033[1m'
    
    banner = f"""
{CYAN}{BOLD}{'='*70}
{GREEN}  Medical AI Platform API Server{CYAN}
{'='*70}{RESET}

  {YELLOW}Status:{RESET}      {GREEN}Running{RESET}
  {YELLOW}Environment:{RESET} Development
  {YELLOW}Server:{RESET}      http://{host}:{port}
  {YELLOW}Docs:{RESET}        http://{host}:{port}/docs

{CYAN}{'='*70}{RESET}
"""
    print(banner)
