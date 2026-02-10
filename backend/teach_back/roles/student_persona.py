"""
Student Persona role for teach-back sessions.

Acts as a junior medical student being taught by the user.
"""

import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class StudentPersona:
    """
    Acts as a junior medical student being taught.
    
    Behavior:
    - Asks clarifying questions when explanation is unclear
    - Shows enthusiasm for learning
    - Requests examples when concepts are abstract
    - Simulates realistic student responses
    """
    
    def __init__(self):
        """Initialize student persona."""
        self.role_name = "Student"
    
    def generate_response(
        self,
        user_input: str,
        conversation_history: List[Dict[str, str]],
        topic: str = None
    ) -> str:
        """
        Generate student response to user's teaching.
        
        Args:
            user_input: Latest input from user
            conversation_history: Previous conversation
            topic: Topic being taught
            
        Returns:
            Student response as string
        """
        # Build context from conversation history
        context = self._build_context(conversation_history, topic)
        
        # Create prompt for LLM
        prompt = f"""You are a junior medical student being taught by a peer. You are eager to learn but sometimes need clarification.

{context}

The student is now teaching you: "{user_input}"

Respond as a curious student would:
- If something is unclear, ask for clarification
- If it's clear, acknowledge and ask a follow-up question to deepen understanding
- Show enthusiasm for learning
- Request examples when concepts are abstract
- Keep responses conversational and natural (2-3 sentences)

IMPORTANT: Never mention that you are an AI or role-playing. Stay in character as a medical student."""
        
        return prompt
    
    def _build_context(
        self,
        conversation_history: List[Dict[str, str]],
        topic: str = None
    ) -> str:
        """Build context string from conversation history."""
        context_parts = []
        
        if topic:
            context_parts.append(f"Topic: {topic}")
        
        if conversation_history:
            context_parts.append("\nPrevious conversation:")
            for entry in conversation_history[-5:]:  # Last 5 exchanges
                speaker = entry.get("speaker", "unknown")
                content = entry.get("content", "")
                context_parts.append(f"{speaker}: {content}")
        
        return "\n".join(context_parts) if context_parts else "This is the start of the teaching session."
