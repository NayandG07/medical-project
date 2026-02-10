"""
Integration layer for teach-back sessions.

Feeds session data to existing learning systems with loose coupling.
"""

import logging
import asyncio
from typing import List, Dict, Any
import os

from .data_storage import DataStorage

logger = logging.getLogger(__name__)


class TeachBackIntegrations:
    """
    Handles integration with existing learning systems.
    
    Feeds teach-back data to:
    - Flashcard generator
    - Weak-area analysis
    - Study planner
    - MCQ suggestions
    
    Integration failures do NOT block session completion.
    """
    
    def __init__(self, data_storage: DataStorage = None):
        """
        Initialize integrations.
        
        Args:
            data_storage: DataStorage instance
        """
        self.data_storage = data_storage or DataStorage()
        
        # Load integration endpoints from environment
        self.flashcard_url = os.getenv("FLASHCARD_SERVICE_URL", "http://localhost:8000/api/flashcards")
        self.weak_area_url = os.getenv("WEAK_AREA_SERVICE_URL", "http://localhost:8000/api/weak-areas")
        self.study_planner_url = os.getenv("STUDY_PLANNER_SERVICE_URL", "http://localhost:8000/api/study-planner")
        self.mcq_url = os.getenv("MCQ_SERVICE_URL", "http://localhost:8000/api/mcqs")
        
        logger.info("TeachBackIntegrations initialized")
    
    async def feed_all_integrations(self, session_id: str) -> Dict[str, bool]:
        """
        Feed session data to all integration endpoints.
        
        Args:
            session_id: UUID of the session
            
        Returns:
            Dictionary with success status for each integration
        """
        results = {}
        
        # Run all integrations in parallel
        tasks = [
            self.feed_to_flashcard_generator(session_id),
            self.feed_to_weak_area_analysis(session_id),
            self.feed_to_study_planner(session_id),
            self.feed_to_mcq_suggestions(session_id)
        ]
        
        integration_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        results["flashcards"] = not isinstance(integration_results[0], Exception)
        results["weak_areas"] = not isinstance(integration_results[1], Exception)
        results["study_planner"] = not isinstance(integration_results[2], Exception)
        results["mcq_suggestions"] = not isinstance(integration_results[3], Exception)
        
        logger.info(f"Integration results for session {session_id}: {results}")
        
        return results
    
    async def feed_to_flashcard_generator(self, session_id: str) -> None:
        """
        Send missed concepts to flashcard generator.
        
        Args:
            session_id: UUID of the session
        """
        try:
            # Get summary
            summary = await self.data_storage.get_summary(session_id)
            if not summary or not summary.missed_concepts:
                logger.info(f"No missed concepts to send for session {session_id}")
                return
            
            # Prepare data
            data = {
                "user_id": str(summary.user_id),
                "topics": summary.missed_concepts,
                "source": "teach_back",
                "session_id": session_id
            }
            
            # Send to flashcard service (async HTTP call)
            # TODO: Implement actual HTTP call when flashcard service is ready
            logger.info(f"Would send {len(summary.missed_concepts)} concepts to flashcard generator")
            
            # Simulate async call
            await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error feeding to flashcard generator: {str(e)}")
            # Don't raise - integration failures should not block
    
    async def feed_to_weak_area_analysis(self, session_id: str) -> None:
        """
        Send error patterns to weak-area analysis system.
        
        Args:
            session_id: UUID of the session
        """
        try:
            # Get errors
            errors = await self.data_storage.get_session_errors(session_id)
            if not errors:
                logger.info(f"No errors to send for session {session_id}")
                return
            
            # Get session for user_id
            session = await self.data_storage.get_session(session_id)
            if not session:
                return
            
            # Extract weak topics from errors
            weak_topics = []
            for error in errors:
                weak_topics.append({
                    "topic": error.error_text,
                    "severity": error.severity.value,
                    "context": error.context
                })
            
            # Prepare data
            data = {
                "user_id": str(session.user_id),
                "weak_areas": weak_topics,
                "source": "teach_back",
                "session_id": session_id
            }
            
            # Send to weak-area service
            # TODO: Implement actual HTTP call when weak-area service is ready
            logger.info(f"Would send {len(weak_topics)} weak areas to analysis system")
            
            # Simulate async call
            await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error feeding to weak-area analysis: {str(e)}")
            # Don't raise - integration failures should not block
    
    async def feed_to_study_planner(self, session_id: str) -> None:
        """
        Send recommendations to study planner.
        
        Args:
            session_id: UUID of the session
        """
        try:
            # Get summary
            summary = await self.data_storage.get_summary(session_id)
            if not summary or not summary.recommendations:
                logger.info(f"No recommendations to send for session {session_id}")
                return
            
            # Prepare data
            data = {
                "user_id": str(summary.user_id),
                "recommendations": summary.recommendations,
                "missed_concepts": summary.missed_concepts,
                "source": "teach_back",
                "session_id": session_id
            }
            
            # Send to study planner service
            # TODO: Implement actual HTTP call when study planner service is ready
            logger.info(f"Would send {len(summary.recommendations)} recommendations to study planner")
            
            # Simulate async call
            await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error feeding to study planner: {str(e)}")
            # Don't raise - integration failures should not block
    
    async def feed_to_mcq_suggestions(self, session_id: str) -> None:
        """
        Send missed concepts to MCQ suggestion system.
        
        Args:
            session_id: UUID of the session
        """
        try:
            # Get summary
            summary = await self.data_storage.get_summary(session_id)
            if not summary or not summary.missed_concepts:
                logger.info(f"No missed concepts to send for session {session_id}")
                return
            
            # Prepare data
            data = {
                "user_id": str(summary.user_id),
                "topics": summary.missed_concepts,
                "source": "teach_back",
                "session_id": session_id
            }
            
            # Send to MCQ service
            # TODO: Implement actual HTTP call when MCQ service is ready
            logger.info(f"Would send {len(summary.missed_concepts)} concepts to MCQ suggestions")
            
            # Simulate async call
            await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error feeding to MCQ suggestions: {str(e)}")
            # Don't raise - integration failures should not block
