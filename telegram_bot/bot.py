"""
VaidyaAI Telegram Bot
Interactive monitoring and log querying
"""
import os
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
import logging
from contextlib import asynccontextmanager

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from fastapi import FastAPI, Request
import uvicorn

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")  # Your chat ID
BOT_WEBHOOK_PORT = int(os.getenv("BOT_WEBHOOK_PORT", "8001"))

# Telegram bot application
telegram_app = None
bot_task = None


async def send_telegram_message(text: str, parse_mode: str = "Markdown"):
    """Send a message to Telegram"""
    try:
        await telegram_app.bot.send_message(
            chat_id=TELEGRAM_CHAT_ID,
            text=text,
            parse_mode=parse_mode
        )
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")


# Telegram Bot Commands

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    await update.message.reply_text(
        "🤖 *VaidyaAI Monitoring Bot*\n\n"
        "Available commands:\n"
        "/status - System health check\n"
        "/logs [feature] [count] - Recent logs\n"
        "/errors [hours] - Recent errors\n"
        "/help - Show this message",
        parse_mode="Markdown"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    await update.message.reply_text(
        "📚 *Command Help*\n\n"
        "**/status** - Check system health\n"
        "Example: `/status`\n\n"
        "**/logs [feature] [count]** - Get recent logs\n"
        "Example: `/logs osce 10`\n"
        "Example: `/logs clinical 5`\n\n"
        "**/errors [hours]** - Get recent errors\n"
        "Example: `/errors 1` (last hour)\n"
        "Example: `/errors 24` (last day)\n\n"
        "**/ping** - Check bot status",
        parse_mode="Markdown"
    )


async def ping_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /ping command"""
    await update.message.reply_text("🏓 Pong! Bot is alive and running.")


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command - check system health"""
    await update.message.reply_text("⏳ Checking system status...")
    
    try:
        # TODO: Query your backend API for health status
        # For now, return a placeholder
        status_message = (
            "✅ *System Status*\n\n"
            "*Backend:* Running\n"
            "*Database:* Connected\n"
            "*HuggingFace:* Active\n"
            "*Last Error:* None\n"
            "*Uptime:* 2h 34m"
        )
        
        await update.message.reply_text(status_message, parse_mode="Markdown")
    
    except Exception as e:
        await update.message.reply_text(f"❌ Error checking status: {e}")


async def logs_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /logs command - get recent logs"""
    try:
        # Parse arguments
        args = context.args
        feature = args[0] if len(args) > 0 else "all"
        count = int(args[1]) if len(args) > 1 else 5
        
        await update.message.reply_text(f"📋 Fetching last {count} logs for {feature}...")
        
        # TODO: Query your database for logs
        # For now, return a placeholder
        logs_message = (
            f"📋 *Recent Logs ({feature})*\n\n"
            f"1. ✅ OSCE interaction - 2m ago\n"
            f"2. ✅ Clinical query - 5m ago\n"
            f"3. ⚠️ Model timeout - 10m ago\n"
            f"4. ✅ Flashcard generation - 15m ago\n"
            f"5. ✅ MCQ generation - 20m ago"
        )
        
        await update.message.reply_text(logs_message, parse_mode="Markdown")
    
    except Exception as e:
        await update.message.reply_text(f"❌ Error fetching logs: {e}")


async def errors_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /errors command - get recent errors"""
    try:
        # Parse arguments
        hours = int(context.args[0]) if context.args else 1
        
        await update.message.reply_text(f"🔍 Fetching errors from last {hours}h...")
        
        # TODO: Query your database for errors
        # For now, return a placeholder
        errors_message = (
            f"⚠️ *Errors (Last {hours}h)*\n\n"
            f"*Total:* 3 errors\n\n"
            f"1. Model timeout (OSCE) - 10m ago\n"
            f"2. Connection error (Clinical) - 45m ago\n"
            f"3. API key failure (MCQ) - 58m ago"
        )
        
        await update.message.reply_text(errors_message, parse_mode="Markdown")
    
    except Exception as e:
        await update.message.reply_text(f"❌ Error fetching errors: {e}")


async def run_bot():
    """Run the Telegram bot with polling"""
    global telegram_app
    
    try:
        logger.info("run_bot() started - building application...")
        
        # Build application
        telegram_app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
        
        logger.info("Application built - adding command handlers...")
        
        # Add command handlers
        telegram_app.add_handler(CommandHandler("start", start_command))
        telegram_app.add_handler(CommandHandler("help", help_command))
        telegram_app.add_handler(CommandHandler("ping", ping_command))
        telegram_app.add_handler(CommandHandler("status", status_command))
        telegram_app.add_handler(CommandHandler("logs", logs_command))
        telegram_app.add_handler(CommandHandler("errors", errors_command))
        
        logger.info("Initializing application...")
        await telegram_app.initialize()
        await telegram_app.start()
        
        logger.info("Starting Telegram bot polling...")
        await telegram_app.updater.start_polling(drop_pending_updates=True)
        
        logger.info("Bot is now polling for updates!")
        
        # Keep running until cancelled
        while True:
            await asyncio.sleep(1)
        
    except asyncio.CancelledError:
        logger.info("Bot polling cancelled")
        raise
    except Exception as e:
        logger.error(f"Error in run_bot(): {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI"""
    global bot_task
    
    logger.info("Lifespan startup: Creating bot task...")
    
    # Startup: Start bot in background
    bot_task = asyncio.create_task(run_bot())
    logger.info(f"Bot webhook server started on port {BOT_WEBHOOK_PORT}")
    logger.info("Bot task created and running in background")
    
    yield
    
    logger.info("Lifespan shutdown: Stopping bot...")
    
    # Shutdown: Stop bot
    if bot_task:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            logger.info("Bot task cancelled")
    
    if telegram_app:
        try:
            await telegram_app.updater.stop()
            await telegram_app.stop()
            await telegram_app.shutdown()
            logger.info("Telegram bot stopped")
        except Exception as e:
            logger.error(f"Error stopping bot: {e}")


# FastAPI app with lifespan
app = FastAPI(lifespan=lifespan)


@app.post("/webhook")
async def receive_webhook(request: Request):
    """Receive webhooks from VaidyaAI backend"""
    try:
        payload = await request.json()
        event = payload.get("event", "notification")
        
        # Format message based on event type
        if event == "model_timeout":
            message = (
                f"🔴 *Model Timeout*\n\n"
                f"*Feature:* {payload.get('feature')}\n"
                f"*Model:* `{payload.get('model')}`\n"
                f"*Timeout:* {payload.get('timeout_seconds')}s\n"
                f"*Time:* {payload.get('timestamp')}"
            )
        
        elif event == "api_key_failure":
            message = (
                f"❌ *API Key Failure*\n\n"
                f"*Provider:* {payload.get('provider')}\n"
                f"*Feature:* {payload.get('feature')}\n"
                f"*Key ID:* `{payload.get('key_id', 'N/A')[:8]}...`\n"
                f"*Error:* {payload.get('error', 'Unknown')[:200]}"
            )
        
        elif event == "fallback":
            message = (
                f"🔄 *Fallback Triggered*\n\n"
                f"*Provider:* {payload.get('provider')}\n"
                f"*Feature:* {payload.get('feature')}\n"
                f"*From:* `{payload.get('from_key_id')}`\n"
                f"*To:* `{payload.get('to_key_id')}`"
            )
        
        else:
            message = f"📢 *{event.replace('_', ' ').title()}*\n\n{payload}"
        
        await send_telegram_message(message)
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=BOT_WEBHOOK_PORT)
