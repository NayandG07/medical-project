"""
Simple Colored Logging - Minimal version without banner
Use this if you prefer a cleaner, more minimal output
"""
import logging
from config.colored_logging import setup_colored_logging

# Setup colored logging without banner
setup_colored_logging(level=logging.INFO)
logger = logging.getLogger(__name__)

# Just log a simple startup message
logger.info("Server starting...")
