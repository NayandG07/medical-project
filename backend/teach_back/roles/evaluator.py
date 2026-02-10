"""
Evaluator role for teach-back sessions.

Detects conceptual errors and triggers interruptions.
"""

import logging
from typing import Dict, Any, List
from ..models import DetectedError, ErrorSeverity

logger = logging.getLogger(__name__)


class Evaluator:
    """
    Detects conceptual errors in user's teaching.
    
    Behavior:
    - Continuously monitors user's teaching for errors
    - Identifies: factual errors, incomplete explanations, misconceptions
    - Generates gentle, constructive corrections
    - Tracks error patterns for summary
    - Assigns severity levels (minor, moderate, critical)
    """
    
    def __init__(self):
        """Initialize evaluator."""
        self.role_name = "Evaluator"
    
    def generate_error_detection_prompt(
        self,
        user_input: str,
        conversation_history: List[Dict[str, str]],
        topic: str = None
    ) -> str:
        """
        Generate prompt for error detection.
        
        Args:
            user_input: Latest input from user
            conversation_history: Previous conversation
            topic: Topic being taught
            
        Returns:
            Prompt for LLM to detect errors
        """
        context = self._build_context(conversation_history, topic)
        
        prompt = f"""You are evaluating a medical student's teaching for accuracy. Identify any factual errors, misconceptions, or incomplete explanations.

{context}

Student's latest explanation: "{user_input}"

Analyze this explanation carefully. If there are errors, respond in this EXACT format:

ERROR_FOUND
Error: [specific error or misconception]
Correction: [correct information]
Severity: [minor/moderate/critical]
Clinical_Relevance: [why this matters clinically]

If there are multiple errors, list each one separately.

If the explanation is accurate and complete, respond with exactly:
NO_ERRORS

Severity guidelines:
- CRITICAL: Could lead to patient harm or serious misunderstanding
- MODERATE: Significant inaccuracy that affects understanding
- MINOR: Small inaccuracy or incomplete detail"""
        
        return prompt
    
    def parse_error_response(
        self,
        llm_response: str,
        session_id: str
    ) -> List[DetectedError]:
        """
        Parse LLM response to extract detected errors.
        
        Args:
            llm_response: Response from LLM
            session_id: Session UUID
            
        Returns:
            List of DetectedError objects
        """
        import uuid
        from datetime import datetime
        
        if "NO_ERRORS" in llm_response:
            return []
        
        errors = []
        
        # Split by ERROR_FOUND markers
        error_blocks = llm_response.split("ERROR_FOUND")[1:]  # Skip first empty split
        
        for block in error_blocks:
            try:
                # Parse error details
                lines = [line.strip() for line in block.strip().split("\n") if line.strip()]
                
                error_text = ""
                correction = ""
                severity = ErrorSeverity.MODERATE
                context = ""
                
                for line in lines:
                    if line.startswith("Error:"):
                        error_text = line.replace("Error:", "").strip()
                    elif line.startswith("Correction:"):
                        correction = line.replace("Correction:", "").strip()
                    elif line.startswith("Severity:"):
                        severity_str = line.replace("Severity:", "").strip().lower()
                        if severity_str == "critical":
                            severity = ErrorSeverity.CRITICAL
                        elif severity_str == "minor":
                            severity = ErrorSeverity.MINOR
                        else:
                            severity = ErrorSeverity.MODERATE
                    elif line.startswith("Clinical_Relevance:"):
                        context = line.replace("Clinical_Relevance:", "").strip()
                
                if error_text and correction:
                    errors.append(DetectedError(
                        id=uuid.uuid4(),
                        session_id=uuid.UUID(session_id),
                        error_text=error_text,
                        correction=correction,
                        context=context,
                        severity=severity,
                        detected_at=datetime.now()
                    ))
            except Exception as e:
                logger.error(f"Error parsing error block: {str(e)}")
                continue
        
        return errors
    
    def generate_interruption_response(
        self,
        errors: List[DetectedError]
    ) -> str:
        """
        Generate gentle interruption with corrections.
        
        Args:
            errors: List of detected errors
            
        Returns:
            Interruption message
        """
        if not errors:
            return ""
        
        # Sort by severity (critical first)
        sorted_errors = sorted(
            errors,
            key=lambda e: {"critical": 0, "moderate": 1, "minor": 2}[e.severity.value]
        )
        
        # Build interruption message
        parts = ["I want to gently correct something:"]
        
        for i, error in enumerate(sorted_errors[:3], 1):  # Max 3 errors at once
            parts.append(f"\n{i}. {error.correction}")
            if error.context:
                parts.append(f"   (This is important because: {error.context})")
        
        parts.append("\nLet's continue from here. Does that make sense?")
        
        return "\n".join(parts)
    
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
            for entry in conversation_history[-5:]:
                speaker = entry.get("speaker", "unknown")
                content = entry.get("content", "")
                context_parts.append(f"{speaker}: {content}")
        
        return "\n".join(context_parts) if context_parts else "This is the start of the teaching session."
