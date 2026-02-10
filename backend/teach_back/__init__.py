"""
Interactive Learning Assistant (Teach-Back Mode)

This module implements a standalone feature that enables medical students to teach
concepts back to an AI tutor through voice and/or text input. The system actively
listens, detects conceptual errors, provides gentle corrections through interruptions,
and conducts an oral-style examination at the end of each session.

Key Components:
- Session Manager: Manages complete lifecycle of teach-back sessions
- State Machine: Handles session state transitions
- Voice Processor: STT/TTS integration for voice modes
- LLM Orchestrator: Coordinates multiple AI roles
- Data Storage: Persists session data and provides retrieval
- Rate Limiter: Enforces independent rate limits
- Integrations: Feeds data to existing learning systems
"""

__version__ = "1.0.0"
