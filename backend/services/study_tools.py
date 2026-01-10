"""
Study Tools Service
Handles generation of flashcards, MCQs, concept maps, and other study materials
Independent from chat sessions
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)


class StudyToolsService:
    """Service for managing study tool sessions and content generation"""
    
    def __init__(self, supabase_client, model_router, rate_limiter):
        """
        Initialize study tools service
        
        Args:
            supabase_client: Supabase client for database operations
            model_router: Model router for AI generation
            rate_limiter: Rate limiter service
        """
        self.supabase = supabase_client
        self.model_router = model_router
        self.rate_limiter = rate_limiter
    
    async def create_session(self, user_id: str, feature: str, title: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new study tool session
        
        Args:
            user_id: User's unique identifier
            feature: Type of tool (flashcard, mcq, conceptmap, etc.)
            title: Optional session title
            
        Returns:
            Created session data
        """
        try:
            session_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            session_data = {
                "id": session_id,
                "user_id": user_id,
                "feature": feature,
                "title": title or f"{feature.title()} Session",
                "created_at": now,
                "updated_at": now
            }
            
            result = self.supabase.table("study_tool_sessions").insert(session_data).execute()
            
            if result.data:
                return result.data[0]
            else:
                raise Exception("Failed to create session")
                
        except Exception as e:
            logger.error(f"Failed to create study tool session: {str(e)}")
            raise
    
    async def get_user_sessions(self, user_id: str, feature: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get all sessions for a user, optionally filtered by feature
        
        Args:
            user_id: User's unique identifier
            feature: Optional filter by feature
            
        Returns:
            List of sessions
        """
        try:
            query = self.supabase.table("study_tool_sessions") \
                .select("*") \
                .eq("user_id", user_id) \
                .order("created_at", desc=True)
            
            if feature:
                query = query.eq("feature", feature)
            
            result = query.execute()
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get user sessions: {str(e)}")
            raise
    
    async def get_session_materials(self, session_id: str, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all materials for a session
        
        Args:
            session_id: Session identifier
            user_id: User's unique identifier (for verification)
            
        Returns:
            List of materials
        """
        try:
            # Verify session belongs to user
            session_result = self.supabase.table("study_tool_sessions") \
                .select("*") \
                .eq("id", session_id) \
                .eq("user_id", user_id) \
                .execute()
            
            if not session_result.data:
                raise Exception("Session not found or access denied")
            
            # Get materials
            materials_result = self.supabase.table("study_materials") \
                .select("*") \
                .eq("session_id", session_id) \
                .order("created_at", desc=True) \
                .execute()
            
            return materials_result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get session materials: {str(e)}")
            raise
    
    async def delete_session(self, session_id: str, user_id: str) -> Dict[str, str]:
        """
        Delete a session and all its materials
        
        Args:
            session_id: Session identifier
            user_id: User's unique identifier (for verification)
            
        Returns:
            Success message
        """
        try:
            # Verify session belongs to user
            session_result = self.supabase.table("study_tool_sessions") \
                .select("*") \
                .eq("id", session_id) \
                .eq("user_id", user_id) \
                .execute()
            
            if not session_result.data:
                raise Exception("Session not found or access denied")
            
            # Delete materials first
            self.supabase.table("study_materials") \
                .delete() \
                .eq("session_id", session_id) \
                .execute()
            
            # Delete session
            self.supabase.table("study_tool_sessions") \
                .delete() \
                .eq("id", session_id) \
                .execute()
            
            return {"message": "Session deleted successfully"}
            
        except Exception as e:
            logger.error(f"Failed to delete session: {str(e)}")
            raise
    
    async def generate_flashcards(
        self,
        user_id: str,
        topic: str,
        session_id: Optional[str] = None,
        format: str = "interactive"
    ) -> Dict[str, Any]:
        """
        Generate flashcards for a topic
        
        Args:
            user_id: User's unique identifier
            topic: Topic to generate flashcards for
            session_id: Optional existing session ID
            format: Output format (interactive or text)
            
        Returns:
            Generated flashcards data
        """
        try:
            # Create session if not provided
            if not session_id:
                session = await self.create_session(user_id, "flashcard", f"Flashcards: {topic}")
                session_id = session["id"]
            
            # Check rate limits
            within_limits = await self.rate_limiter.check_rate_limit(user_id, "flashcard")
            if not within_limits:
                raise Exception("Rate limit exceeded")
            
            # Generate prompt based on format
            if format == "interactive":
                system_prompt = """You are a medical education expert. Generate flashcards in a clear Q&A format.
Format each flashcard as:
Q: [Question]
A: [Answer]

Generate 5-10 flashcards covering key concepts. Keep questions concise and answers detailed but focused."""
            else:
                system_prompt = "You are a medical education expert. Generate comprehensive flashcards for studying."
            
            prompt = f"Generate flashcards about: {topic}"
            
            # Get provider and generate content
            provider = await self.model_router.select_provider("flashcard")
            content = await self.model_router.execute_with_fallback(
                provider=provider,
                feature="flashcard",
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            # Record usage
            await self.rate_limiter.increment_usage(user_id, tokens=100, feature="flashcard")
            
            # Save material
            material_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            material_data = {
                "id": material_id,
                "session_id": session_id,
                "feature": "flashcard",
                "topic": topic,
                "content": content,
                "tokens_used": 100,
                "created_at": now
            }
            
            self.supabase.table("study_materials").insert(material_data).execute()
            
            return {
                "id": material_id,
                "session_id": session_id,
                "topic": topic,
                "content": content,
                "created_at": now
            }
            
        except Exception as e:
            logger.error(f"Failed to generate flashcards: {str(e)}")
            raise
    
    async def generate_mcq(
        self,
        user_id: str,
        topic: str,
        session_id: Optional[str] = None,
        format: str = "interactive"
    ) -> Dict[str, Any]:
        """
        Generate multiple choice questions for a topic
        
        Args:
            user_id: User's unique identifier
            topic: Topic to generate MCQs for
            session_id: Optional existing session ID
            format: Output format
            
        Returns:
            Generated MCQ data
        """
        try:
            if not session_id:
                session = await self.create_session(user_id, "mcq", f"MCQ: {topic}")
                session_id = session["id"]
            
            within_limits = await self.rate_limiter.check_rate_limit(user_id, "mcq")
            if not within_limits:
                raise Exception("Rate limit exceeded")
            
            system_prompt = """You are a medical education expert. Generate multiple choice questions in this format:

Question 1: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter]
Explanation: [Why this is correct]

Generate 5-10 high-quality MCQs that test understanding, not just memorization."""
            
            prompt = f"Generate multiple choice questions about: {topic}"
            
            provider = await self.model_router.select_provider("mcq")
            content = await self.model_router.execute_with_fallback(
                provider=provider,
                feature="mcq",
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            await self.rate_limiter.increment_usage(user_id, tokens=150, feature="mcq")
            
            material_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            material_data = {
                "id": material_id,
                "session_id": session_id,
                "feature": "mcq",
                "topic": topic,
                "content": content,
                "tokens_used": 150,
                "created_at": now
            }
            
            self.supabase.table("study_materials").insert(material_data).execute()
            
            return {
                "id": material_id,
                "session_id": session_id,
                "topic": topic,
                "content": content,
                "created_at": now
            }
            
        except Exception as e:
            logger.error(f"Failed to generate MCQ: {str(e)}")
            raise
    
    async def generate_conceptmap(
        self,
        user_id: str,
        topic: str,
        session_id: Optional[str] = None,
        format: str = "visual"
    ) -> Dict[str, Any]:
        """
        Generate a concept map for a topic
        
        Args:
            user_id: User's unique identifier
            topic: Topic to generate concept map for
            session_id: Optional existing session ID
            format: Output format (visual or text)
            
        Returns:
            Generated concept map data
        """
        try:
            if not session_id:
                session = await self.create_session(user_id, "map", f"Concept Map: {topic}")
                session_id = session["id"]
            
            within_limits = await self.rate_limiter.check_rate_limit(user_id, "chat")
            if not within_limits:
                raise Exception("Rate limit exceeded")
            
            system_prompt = """You are a medical education expert. Generate a clinical concept map in this EXACT format:

MAIN: [Main topic/condition]
SYMPTOM: [Symptom 1]
SYMPTOM: [Symptom 2]
SYMPTOM: [Symptom 3]
DIAGNOSIS: [Diagnostic method 1]
DIAGNOSIS: [Diagnostic method 2]
DIAGNOSIS: [Diagnostic method 3]
TREATMENT: [Treatment option 1]
TREATMENT: [Treatment option 2]
TREATMENT: [Treatment option 3]
COMPLICATION: [Risk factor or complication 1]
COMPLICATION: [Risk factor or complication 2]
CONNECTION: [Main topic] -> [Symptom 1]
CONNECTION: [Main topic] -> [Symptom 2]
CONNECTION: [Main topic] -> [Diagnosis 1]
CONNECTION: [Main topic] -> [Treatment 1]
CONNECTION: [Main topic] -> [Complication 1]

CRITICAL RULES:
1. Start each line with exactly one of: MAIN:, SYMPTOM:, DIAGNOSIS:, TREATMENT:, COMPLICATION:, CONNECTION:
2. Use exact node labels in connections (must match the labels you defined)
3. Include at least 3 symptoms, 3 diagnoses, 3 treatments, and 2 complications
4. No extra text, explanations, or markdown formatting
5. Each item on a new line

Example:
MAIN: Pulmonary Embolism
SYMPTOM: Shortness of breath
SYMPTOM: Chest pain
SYMPTOM: Tachycardia
DIAGNOSIS: D-Dimer test
DIAGNOSIS: CT Pulmonary Angiography
DIAGNOSIS: V/Q Scan
TREATMENT: Heparin
TREATMENT: Warfarin
TREATMENT: Thrombolysis
COMPLICATION: Deep vein thrombosis
COMPLICATION: Right heart strain
CONNECTION: Pulmonary Embolism -> Shortness of breath
CONNECTION: Pulmonary Embolism -> Chest pain
CONNECTION: Pulmonary Embolism -> D-Dimer test
CONNECTION: Pulmonary Embolism -> Heparin"""
            
            prompt = f"Generate a clinical concept map for: {topic}"
            
            provider = await self.model_router.select_provider("map")
            result = await self.model_router.execute_with_fallback(
                provider=provider,
                feature="map",
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            # Extract the actual content from the result
            content = result.get("content", "") if isinstance(result, dict) else str(result)
            
            await self.rate_limiter.increment_usage(user_id, tokens=120, feature="map")
            
            material_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            material_data = {
                "id": material_id,
                "session_id": session_id,
                "feature": "map",
                "topic": topic,
                "content": content,
                "tokens_used": result.get("tokens_used", 120) if isinstance(result, dict) else 120,
                "created_at": now
            }
            
            self.supabase.table("study_materials").insert(material_data).execute()
            
            return {
                "id": material_id,
                "session_id": session_id,
                "topic": topic,
                "content": content,
                "created_at": now
            }
            
        except Exception as e:
            logger.error(f"Failed to generate concept map: {str(e)}")
            raise
    
    async def generate_highyield(
        self,
        user_id: str,
        topic: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate high-yield summary points for a topic
        
        Args:
            user_id: User's unique identifier
            topic: Topic to generate summary for
            session_id: Optional existing session ID
            
        Returns:
            Generated high-yield summary data
        """
        try:
            if not session_id:
                session = await self.create_session(user_id, "highyield", f"High-Yield: {topic}")
                session_id = session["id"]
            
            within_limits = await self.rate_limiter.check_rate_limit(user_id, "chat")
            if not within_limits:
                raise Exception("Rate limit exceeded")
            
            system_prompt = """You are a medical education expert. Generate high-yield summary points that are:
- Concise and focused on exam-relevant information
- Organized by category (Pathophysiology, Clinical Features, Diagnosis, Treatment, etc.)
- Easy to memorize
- Clinically relevant

Format with clear headers and bullet points."""
            
            prompt = f"Generate high-yield summary points for: {topic}"
            
            provider = await self.model_router.select_provider("chat")
            content = await self.model_router.execute_with_fallback(
                provider=provider,
                feature="chat",
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            await self.rate_limiter.increment_usage(user_id, tokens=100, feature="chat")
            
            material_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            material_data = {
                "id": material_id,
                "session_id": session_id,
                "feature": "highyield",
                "topic": topic,
                "content": content,
                "tokens_used": 100,
                "created_at": now
            }
            
            self.supabase.table("study_materials").insert(material_data).execute()
            
            return {
                "id": material_id,
                "session_id": session_id,
                "topic": topic,
                "content": content,
                "created_at": now
            }
            
        except Exception as e:
            logger.error(f"Failed to generate high-yield summary: {str(e)}")
            raise
    
    async def generate_explanation(
        self,
        user_id: str,
        topic: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate detailed explanation for a topic
        
        Args:
            user_id: User's unique identifier
            topic: Topic to explain
            session_id: Optional existing session ID
            
        Returns:
            Generated explanation data
        """
        try:
            if not session_id:
                session = await self.create_session(user_id, "explain", f"Explanation: {topic}")
                session_id = session["id"]
            
            within_limits = await self.rate_limiter.check_rate_limit(user_id, "chat")
            if not within_limits:
                raise Exception("Rate limit exceeded")
            
            system_prompt = """You are a medical education expert. Provide a detailed, clear explanation that:
- Breaks down complex concepts into understandable parts
- Uses analogies and examples where helpful
- Explains the clinical relevance
- Includes key points to remember

Make it comprehensive but accessible."""
            
            prompt = f"Explain in detail: {topic}"
            
            provider = await self.model_router.select_provider("chat")
            content = await self.model_router.execute_with_fallback(
                provider=provider,
                feature="chat",
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            await self.rate_limiter.increment_usage(user_id, tokens=150, feature="chat")
            
            material_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            material_data = {
                "id": material_id,
                "session_id": session_id,
                "feature": "explain",
                "topic": topic,
                "content": content,
                "tokens_used": 150,
                "created_at": now
            }
            
            self.supabase.table("study_materials").insert(material_data).execute()
            
            return {
                "id": material_id,
                "session_id": session_id,
                "topic": topic,
                "content": content,
                "created_at": now
            }
            
        except Exception as e:
            logger.error(f"Failed to generate explanation: {str(e)}")
            raise


# Singleton instance
_study_tools_service = None


def get_study_tools_service(supabase_client=None, model_router=None, rate_limiter=None):
    """Get or create study tools service instance"""
    global _study_tools_service
    
    if _study_tools_service is None:
        if supabase_client is None:
            raise ValueError("supabase_client is required to initialize StudyToolsService")
        
        # Auto-initialize dependencies if not provided
        if model_router is None:
            from services.model_router import get_model_router_service
            model_router = get_model_router_service(supabase_client)
        
        if rate_limiter is None:
            from services.rate_limiter import get_rate_limiter
            rate_limiter = get_rate_limiter(supabase_client)
        
        _study_tools_service = StudyToolsService(supabase_client, model_router, rate_limiter)
    
    return _study_tools_service
