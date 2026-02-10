"""
Examiner role for teach-back sessions.

Conducts OSCE-style oral examination.
"""

import logging
from typing import Dict, Any, List
from ..models import DetectedError

logger = logging.getLogger(__name__)


class Examiner:
    """
    Conducts oral examination at session end.
    
    Behavior:
    - Generates questions based on errors and taught content
    - Focuses on areas with errors or gaps
    - Evaluates user responses
    - Provides performance feedback
    - Uses OSCE examination style
    """
    
    def __init__(self):
        """Initialize examiner."""
        self.role_name = "Examiner"
    
    def generate_examination_questions(
        self,
        topic: str,
        errors: List[DetectedError],
        strong_areas: List[str],
        num_questions: int = 5
    ) -> str:
        """
        Generate examination questions based on session.
        
        Args:
            topic: Topic that was taught
            errors: Errors detected during teaching
            strong_areas: Areas covered well
            num_questions: Number of questions to generate
            
        Returns:
            Prompt for LLM to generate questions
        """
        # Build error summary
        error_summary = self._build_error_summary(errors)
        strong_summary = ", ".join(strong_areas) if strong_areas else "None identified"
        
        prompt = f"""You are an OSCE examiner conducting an oral examination. The student has just taught you about: {topic}

Areas where they made errors or showed gaps:
{error_summary}

Areas they covered well:
{strong_summary}

Generate {num_questions} examination questions that:
1. Test understanding of areas where errors occurred (prioritize these)
2. Probe depth of knowledge in well-covered areas
3. Follow OSCE examination style (clear, focused, clinically relevant)
4. Progress from basic recall to application/analysis
5. Are appropriate for a medical student level

Format each question clearly, numbered 1-{num_questions}.
Keep questions concise and focused."""
        
        return prompt
    
    def generate_evaluation_prompt(
        self,
        question: str,
        user_answer: str,
        correct_answer_context: str = None
    ) -> str:
        """
        Generate prompt to evaluate user's answer.
        
        Args:
            question: Question that was asked
            user_answer: User's answer
            correct_answer_context: Context about correct answer
            
        Returns:
            Prompt for LLM to evaluate answer
        """
        context_part = f"\n\nCorrect answer context:\n{correct_answer_context}" if correct_answer_context else ""
        
        prompt = f"""You are an OSCE examiner evaluating a medical student's answer.

Question: {question}

Student's answer: {user_answer}{context_part}

Evaluate this answer and provide:
1. Score (0-10 scale):
   - 0-3: Incorrect or severely incomplete
   - 4-6: Partially correct with significant gaps
   - 7-8: Mostly correct with minor gaps
   - 9-10: Excellent, comprehensive answer

2. Brief evaluation (2-3 sentences):
   - What was correct
   - What was missing or incorrect
   - Key teaching point

Format your response as:
SCORE: [0-10]
EVALUATION: [your evaluation]"""
        
        return prompt
    
    def parse_evaluation_response(
        self,
        llm_response: str
    ) -> Dict[str, Any]:
        """
        Parse LLM evaluation response.
        
        Args:
            llm_response: Response from LLM
            
        Returns:
            Dictionary with score and evaluation
        """
        result = {
            "score": 5,  # Default middle score
            "evaluation": ""
        }
        
        try:
            lines = llm_response.strip().split("\n")
            
            for line in lines:
                if line.startswith("SCORE:"):
                    score_str = line.replace("SCORE:", "").strip()
                    try:
                        score = int(score_str)
                        result["score"] = max(0, min(10, score))  # Clamp to 0-10
                    except ValueError:
                        logger.warning(f"Could not parse score: {score_str}")
                
                elif line.startswith("EVALUATION:"):
                    result["evaluation"] = line.replace("EVALUATION:", "").strip()
            
            # If evaluation spans multiple lines, capture all
            if "EVALUATION:" in llm_response:
                eval_start = llm_response.index("EVALUATION:") + len("EVALUATION:")
                result["evaluation"] = llm_response[eval_start:].strip()
        
        except Exception as e:
            logger.error(f"Error parsing evaluation response: {str(e)}")
        
        return result
    
    def generate_performance_summary(
        self,
        scores: List[int],
        evaluations: List[str]
    ) -> str:
        """
        Generate overall performance summary.
        
        Args:
            scores: List of scores from examination
            evaluations: List of evaluations
            
        Returns:
            Summary prompt for LLM
        """
        if not scores:
            return "No examination questions were answered."
        
        avg_score = sum(scores) / len(scores)
        
        prompt = f"""Based on the examination results:

Average score: {avg_score:.1f}/10
Number of questions: {len(scores)}

Individual evaluations:
{chr(10).join(f"{i+1}. Score {scores[i]}/10: {evaluations[i]}" for i in range(len(scores)))}

Provide a brief overall performance summary (3-4 sentences):
- Overall performance level
- Key strengths demonstrated
- Main areas for improvement
- Encouragement and next steps"""
        
        return prompt
    
    def _build_error_summary(self, errors: List[DetectedError]) -> str:
        """Build summary of errors for question generation."""
        if not errors:
            return "No significant errors detected"
        
        # Group by severity
        critical = [e for e in errors if e.severity.value == "critical"]
        moderate = [e for e in errors if e.severity.value == "moderate"]
        minor = [e for e in errors if e.severity.value == "minor"]
        
        summary_parts = []
        
        if critical:
            summary_parts.append(f"Critical errors ({len(critical)}):")
            for e in critical[:3]:  # Max 3
                summary_parts.append(f"  - {e.error_text}")
        
        if moderate:
            summary_parts.append(f"Moderate errors ({len(moderate)}):")
            for e in moderate[:3]:
                summary_parts.append(f"  - {e.error_text}")
        
        if minor:
            summary_parts.append(f"Minor gaps ({len(minor)}):")
            for e in minor[:2]:
                summary_parts.append(f"  - {e.error_text}")
        
        return "\n".join(summary_parts)
