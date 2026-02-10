"""
LLM orchestrator for teach-back sessions.

Coordinates multiple AI roles and handles LLM failover.
Integrates with existing API key management system.
"""

import os
import logging
import asyncio
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

from .models import (
    Session, SessionState, DetectedError, OrchestratedResponse
)
from .roles import StudentPersona, Evaluator, Controller, Examiner

# Import existing model router for API key management
from services.model_router import ModelRouterService

load_dotenv()
logger = logging.getLogger(__name__)


class LLMOrchestrator:
    """
    Coordinates multiple AI roles for teach-back sessions.
    
    Uses existing API key management system:
    - Primary LLM: Configured via admin panel (feature: teach_back_primary)
    - Fallback LLM: Hugging Face m42-health/Llama3-Med42-70B (via huggingface.py)
    
    Handles:
    - Role selection based on session state
    - Automatic LLM failover (primary → fallback)
    - Response generation and filtering
    - Error detection
    - Examination question generation
    """
    
    def __init__(self, supabase_client=None):
        """
        Initialize LLM orchestrator.
        
        Args:
            supabase_client: Optional Supabase client for dependency injection
        """
        # Initialize roles
        self.roles = {
            "student": StudentPersona(),
            "evaluator": Evaluator(),
            "controller": Controller(),
            "examiner": Examiner()
        }
        
        # Initialize model router for API key management
        # This handles:
        # - Getting API keys from admin panel
        # - Automatic failover to Hugging Face
        # - User personal API key support
        self.model_router = ModelRouterService(supabase_client)
        
        logger.info("LLMOrchestrator initialized with API key management integration")
    
    def _filter_role_names(self, text: str) -> str:
        """
        Remove internal role names from response.
        
        Args:
            text: Response text
            
        Returns:
            Filtered text
        """
        role_names = [
            "Student_Persona", "StudentPersona",
            "Evaluator",
            "Controller",
            "Examiner",
            "Student", "Evaluator", "Controller", "Examiner"
        ]
        
        filtered = text
        for role_name in role_names:
            filtered = filtered.replace(role_name, "")
            filtered = filtered.replace(role_name.lower(), "")
        
        return filtered.strip()
    
    async def generate_response(
        self,
        session: Session,
        user_input: str,
        conversation_history: List[Dict[str, str]],
        user_id: Optional[str] = None
    ) -> OrchestratedResponse:
        """
        Generate response based on session state.
        
        Uses model router to get API keys from admin panel.
        Automatically falls back to Hugging Face if primary fails.
        
        Args:
            session: Current session
            user_input: Latest user input
            conversation_history: Previous conversation
            user_id: Optional user ID for personal API key support
            
        Returns:
            OrchestratedResponse with content and metadata
        """
        try:
            # Select role based on state
            if session.state == SessionState.TEACHING:
                # Use student persona for teaching phase
                role = self.roles["student"]
                prompt = role.generate_response(
                    user_input,
                    conversation_history,
                    session.topic
                )
                
                # Use model router to execute with automatic fallback
                # Feature: teach_back_primary (will use admin-configured API keys)
                result = await self.model_router.execute_with_fallback(
                    provider="openrouter",  # Default provider, can be overridden by admin keys
                    feature="teach_back_primary",
                    prompt=prompt,
                    system_prompt="You are a curious medical student learning from a teacher.",
                    max_retries=3,
                    user_id=user_id
                )
                
                if not result["success"]:
                    # If all attempts failed, return error
                    error_msg = result.get("error", "Unknown error")
                    logger.error(f"All LLM attempts failed: {error_msg}")
                    raise Exception(f"LLM generation failed: {error_msg}")
                
                response_text = result["content"]
                
                # Detect errors in parallel
                errors = await self.detect_errors(session, user_input, conversation_history, user_id)
                
                # Check if should interrupt
                controller = self.roles["controller"]
                should_interrupt = controller.should_interrupt(errors)
                
                # Filter role names
                filtered_response = self._filter_role_names(response_text)
                
                return OrchestratedResponse(
                    content=filtered_response,
                    role_used="student",
                    detected_errors=errors,
                    should_interrupt=should_interrupt,
                    state_transition=SessionState.INTERRUPTED if should_interrupt else None
                )
            
            elif session.state == SessionState.INTERRUPTED:
                # Generate interruption with corrections
                evaluator = self.roles["evaluator"]
                
                # Get recent errors (should be passed in, but we'll handle gracefully)
                interruption_text = "Let me clarify that point..."
                
                return OrchestratedResponse(
                    content=interruption_text,
                    role_used="evaluator",
                    detected_errors=[],
                    should_interrupt=False,
                    state_transition=None
                )
            
            elif session.state == SessionState.EXAMINING:
                # Use examiner for examination phase
                # This would typically be called separately for question generation
                return OrchestratedResponse(
                    content="Let me ask you a question about what you taught...",
                    role_used="examiner",
                    detected_errors=[],
                    should_interrupt=False,
                    state_transition=None
                )
            
            else:
                # Completed or unknown state
                return OrchestratedResponse(
                    content="Session completed.",
                    role_used="none",
                    detected_errors=[],
                    should_interrupt=False,
                    state_transition=None
                )
                
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise
    
    async def detect_errors(
        self,
        session: Session,
        user_input: str,
        conversation_history: List[Dict[str, str]],
        user_id: Optional[str] = None
    ) -> List[DetectedError]:
        """
        Detect errors in user's teaching.
        
        Uses model router with automatic fallback to Hugging Face.
        
        Args:
            session: Current session
            user_input: Latest user input
            conversation_history: Previous conversation
            user_id: Optional user ID for personal API key support
            
        Returns:
            List of DetectedError objects
        """
        try:
            evaluator = self.roles["evaluator"]
            
            # Generate error detection prompt
            prompt = evaluator.generate_error_detection_prompt(
                user_input,
                conversation_history,
                session.topic
            )
            
            # Use model router with automatic fallback
            result = await self.model_router.execute_with_fallback(
                provider="openrouter",
                feature="teach_back_primary",
                prompt=prompt,
                system_prompt="You are a medical education expert evaluating teaching accuracy.",
                max_retries=3,
                user_id=user_id
            )
            
            if not result["success"]:
                logger.error(f"Error detection failed: {result.get('error')}")
                return []  # Return empty list on failure
            
            # Parse errors
            errors = evaluator.parse_error_response(result["content"], str(session.id))
            
            logger.info(f"Detected {len(errors)} error(s) in user input")
            return errors
            
        except Exception as e:
            logger.error(f"Error detecting errors: {str(e)}")
            return []
    
    async def generate_examination_question(
        self,
        session: Session,
        errors: List[DetectedError],
        strong_areas: List[str],
        user_id: Optional[str] = None
    ) -> str:
        """
        Generate examination question.
        
        Uses model router with automatic fallback to Hugging Face.
        
        Args:
            session: Current session
            errors: Errors detected during teaching
            strong_areas: Areas covered well
            user_id: Optional user ID for personal API key support
            
        Returns:
            Examination question text
        """
        try:
            examiner = self.roles["examiner"]
            
            # Generate question prompt
            prompt = examiner.generate_examination_questions(
                session.topic or "medical concepts",
                errors,
                strong_areas,
                num_questions=1
            )
            
            # Use model router with automatic fallback
            result = await self.model_router.execute_with_fallback(
                provider="openrouter",
                feature="teach_back_primary",
                prompt=prompt,
                system_prompt="You are an OSCE examiner creating clinical examination questions.",
                max_retries=3,
                user_id=user_id
            )
            
            if not result["success"]:
                logger.error(f"Question generation failed: {result.get('error')}")
                # Return default question on failure
                return "Please explain the key concepts you taught and how they relate to clinical practice."
            
            # Filter role names
            filtered_response = self._filter_role_names(result["content"])
            
            return filtered_response
            
        except Exception as e:
            logger.error(f"Error generating examination question: {str(e)}")
            raise
    
    async def evaluate_answer(
        self,
        question: str,
        user_answer: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluate user's answer to examination question.
        
        Uses model router with automatic fallback to Hugging Face.
        
        Args:
            question: Question that was asked
            user_answer: User's answer
            user_id: Optional user ID for personal API key support
            
        Returns:
            Dictionary with score and evaluation
        """
        try:
            examiner = self.roles["examiner"]
            
            # Generate evaluation prompt
            prompt = examiner.generate_evaluation_prompt(question, user_answer)
            
            # Use model router with automatic fallback
            result = await self.model_router.execute_with_fallback(
                provider="openrouter",
                feature="teach_back_primary",
                prompt=prompt,
                system_prompt="You are an OSCE examiner evaluating clinical answers.",
                max_retries=3,
                user_id=user_id
            )
            
            if not result["success"]:
                logger.error(f"Answer evaluation failed: {result.get('error')}")
                return {"score": 5, "evaluation": "Unable to evaluate answer."}
            
            # Parse evaluation
            evaluation = examiner.parse_evaluation_response(result["content"])
            
            return evaluation
            
        except Exception as e:
            logger.error(f"Error evaluating answer: {str(e)}")
            return {"score": 5, "evaluation": "Unable to evaluate answer."}
