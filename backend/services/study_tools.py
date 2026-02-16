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
            
            # Delete materials first (foreign key constraint)
            try:
                self.supabase.table("study_materials") \
                    .delete() \
                    .eq("session_id", session_id) \
                    .execute()
            except Exception as mat_error:
                logger.warning(f"Error deleting materials for session {session_id}: {str(mat_error)}")
                # Continue anyway to try deleting the session
            
            # Delete session
            self.supabase.table("study_tool_sessions") \
                .delete() \
                .eq("id", session_id) \
                .eq("user_id", user_id) \
                .execute()
            
            return {"message": "Session deleted successfully"}
            
        except Exception as e:
            logger.error(f"Failed to delete session {session_id}: {str(e)}")
            raise
    
    async def delete_all_sessions(self, user_id: str, feature: Optional[str] = None) -> Dict[str, Any]:
        """
        Delete all sessions for a user, optionally filtered by feature
        
        Args:
            user_id: User's unique identifier
            feature: Optional filter by feature
            
        Returns:
            Deletion summary
        """
        try:
            # Get all sessions to delete
            sessions = await self.get_user_sessions(user_id, feature)
            
            if not sessions:
                return {"message": "No sessions to delete", "deleted_count": 0}
            
            session_ids = [s["id"] for s in sessions]
            
            # Delete materials first (one by one to avoid issues)
            materials_deleted = 0
            for session_id in session_ids:
                try:
                    result = self.supabase.table("study_materials") \
                        .delete() \
                        .eq("session_id", session_id) \
                        .execute()
                    materials_deleted += len(result.data) if result.data else 0
                except Exception as mat_error:
                    logger.warning(f"Error deleting materials for session {session_id}: {str(mat_error)}")
            
            # Delete sessions one by one
            deleted_count = 0
            for session_id in session_ids:
                try:
                    self.supabase.table("study_tool_sessions") \
                        .delete() \
                        .eq("id", session_id) \
                        .eq("user_id", user_id) \
                        .execute()
                    deleted_count += 1
                except Exception as sess_error:
                    logger.warning(f"Error deleting session {session_id}: {str(sess_error)}")
            
            return {
                "message": f"Deleted {deleted_count} sessions successfully",
                "deleted_count": deleted_count,
                "materials_deleted": materials_deleted
            }
            
        except Exception as e:
            logger.error(f"Failed to delete all sessions: {str(e)}")
            raise
    
    async def generate_flashcards(
        self,
        user_id: str,
        topic: str,
        session_id: Optional[str] = None,
        count: int = 5,
        format: str = "interactive"
    ) -> Dict[str, Any]:
        """
        Generate flashcards for a topic
        
        Args:
            user_id: User's unique identifier
            topic: Topic to generate flashcards for
            session_id: Optional existing session ID
            count: Number of flashcards to generate (default: 5, max: 20)
            format: Output format (interactive or static)
            
        Returns:
            Generated flashcards data
        """
        try:
            # Limit count to reasonable range
            count = max(1, min(count, 20))
            
            # Create session if not provided
            if not session_id:
                session = await self.create_session(user_id, "flashcard", f"Flashcards: {topic}")
                session_id = session["id"]
            
            # Check rate limits
            within_limits = await self.rate_limiter.check_rate_limit(user_id, "flashcard")
            if not within_limits:
                raise Exception("Rate limit exceeded")
            
            # Generate prompt for interactive flashcards (JSON format for frontend rendering)
            system_prompt = f"""You are a medical education expert. You MUST generate EXACTLY {count} flashcards.

CRITICAL: Generate {count} flashcards. Not {count-1}, not {count+1}, but EXACTLY {count} flashcards.

Return ONLY valid JSON in this format:
{{"flashcards":[{{"front":"Term1","back":"Explanation1"}},{{"front":"Term2","back":"Explanation2"}},{{"front":"Term3","back":"Explanation3"}}]}}

RULES:
- Front: Concise medical term or concept (1-5 words)
- Back: Clear, focused explanation (2-4 sentences)
- Generate EXACTLY {count} items in the flashcards array
- No markdown, no code blocks, no extra text
- Valid JSON only

Example structure for {count} flashcards:
{{"flashcards":[
{",".join([f'{{"front":"Term{i+1}","back":"Explanation for term {i+1}"}}' for i in range(min(3, count))])}
{f',{{"front":"Term{count}","back":"Explanation for term {count}"}}' if count > 3 else ''}
]}}

COUNT CHECK: Your response must have EXACTLY {count} objects in the flashcards array."""
            
            prompt = f"Create EXACTLY {count} medical flashcards about: {topic}. Remember: {count} flashcards, no more, no less."
            
            # Get provider and generate content
            provider = await self.model_router.select_provider("flashcard")
            result = await self.model_router.execute_with_fallback(
                provider=provider,
                feature="flashcard",
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            # Extract content from result
            content = result.get("content", "") if isinstance(result, dict) else str(result)
            tokens_used = result.get("tokens_used", 100) if isinstance(result, dict) else 100
            
            # Parse JSON response for interactive format
            flashcards_data = None
            if format == "interactive":
                try:
                    # Try to parse the JSON response
                    import json
                    import re
                    
                    logger.info(f"Raw flashcards content (first 500 chars): {content[:500]}")
                    
                    # Clean the content
                    cleaned = content.strip()
                    
                    # Check if the entire response is a JSON string (wrapped in quotes)
                    if cleaned.startswith('"') and cleaned.endswith('"'):
                        # The AI returned the JSON as a string, unescape it
                        try:
                            cleaned = json.loads(cleaned)  # This will unescape the string
                            logger.info("Unescaped JSON string wrapper")
                        except Exception as e:
                            logger.warning(f"Failed to unescape JSON string: {e}")
                    
                    # Convert to string if it's not already
                    if not isinstance(cleaned, str):
                        cleaned = str(cleaned)
                    
                    # Remove markdown code blocks
                    if "```json" in cleaned:
                        start = cleaned.find("```json") + 7
                        end = cleaned.find("```", start)
                        if end != -1:
                            cleaned = cleaned[start:end].strip()
                    elif "```" in cleaned:
                        start = cleaned.find("```") + 3
                        end = cleaned.find("```", start)
                        if end != -1:
                            cleaned = cleaned[start:end].strip()
                    
                    # Find JSON object boundaries
                    first_brace = cleaned.find('{')
                    last_brace = cleaned.rfind('}')
                    if first_brace != -1 and last_brace != -1:
                        cleaned = cleaned[first_brace:last_brace + 1]
                    else:
                        raise ValueError("No JSON object found in response")
                    
                    # Remove trailing commas before closing braces/brackets
                    cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned)
                    
                    # Fix common issues
                    # Remove any control characters
                    cleaned = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', cleaned)
                    
                    logger.info(f"Cleaned JSON (first 500 chars): {cleaned[:500]}")
                    
                    # Try to parse
                    flashcards_data = json.loads(cleaned)
                    
                    # Validate structure
                    if "flashcards" in flashcards_data and isinstance(flashcards_data["flashcards"], list):
                        actual_count = len(flashcards_data["flashcards"])
                        if actual_count > 0:
                            logger.info(f"Successfully parsed {actual_count} flashcards (requested: {count})")
                            if actual_count != count:
                                logger.warning(f"AI generated {actual_count} flashcards but {count} were requested")
                        else:
                            logger.warning("Parsed JSON but flashcards array is empty")
                            flashcards_data = None
                    else:
                        logger.warning("Parsed JSON but missing 'flashcards' array")
                        flashcards_data = None
                    
                except Exception as parse_error:
                    logger.error(f"Failed to parse flashcards JSON: {str(parse_error)}")
                    logger.error(f"Content that failed to parse (first 1000 chars): {content[:1000]}")
                    
                    # Fallback: Try to manually extract flashcards from the raw JSON-like text
                    flashcards_list = []
                    
                    try:
                        # Use regex to extract front/back pairs from JSON-like structure
                        pattern = r'"front"\s*:\s*"([^"]+)"\s*,\s*"back"\s*:\s*"([^"]+)"'
                        matches = re.findall(pattern, content, re.DOTALL)
                        
                        for front, back in matches:
                            # Clean up the text
                            front = front.strip()
                            back = back.strip()
                            # Remove escaped characters
                            back = back.replace('\\n', ' ').replace('\\t', ' ')
                            flashcards_list.append({"front": front, "back": back})
                        
                        if flashcards_list:
                            flashcards_data = {"flashcards": flashcards_list}
                            logger.info(f"Extracted {len(flashcards_list)} flashcards using regex")
                    except Exception as regex_error:
                        logger.error(f"Regex extraction also failed: {str(regex_error)}")
                    
                    # If regex didn't work, try line-by-line parsing
                    if not flashcards_list:
                        lines = content.split('\n')
                        current_front = None
                        current_back = None
                        
                        for line in lines:
                            line = line.strip()
                            if not line:
                                continue
                            
                            # Look for front/back patterns
                            if line.lower().startswith(('front:', '"front":', '**front', 'front":')):
                                if current_front and current_back:
                                    flashcards_list.append({"front": current_front, "back": current_back})
                                current_front = re.sub(r'^[^:]+:\s*', '', line).strip(' "')
                                current_back = None
                            elif line.lower().startswith(('back:', '"back":', '**back', 'back":')):
                                current_back = re.sub(r'^[^:]+:\s*', '', line).strip(' "')
                            elif current_front and not current_back:
                                # Continuation of front
                                current_front += " " + line
                            elif current_back:
                                # Continuation of back
                                current_back += " " + line
                        
                        # Add last card
                        if current_front and current_back:
                            flashcards_list.append({"front": current_front, "back": current_back})
                        
                        if flashcards_list:
                            flashcards_data = {"flashcards": flashcards_list}
                            logger.info(f"Extracted {len(flashcards_list)} flashcards from text format")
                        else:
                            logger.warning("Could not extract flashcards from text format either")
            
            # Record usage
            await self.rate_limiter.increment_usage(user_id, tokens=tokens_used, feature="flashcard")
            
            # Save material
            material_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            material_data = {
                "id": material_id,
                "session_id": session_id,
                "feature": "flashcard",
                "topic": topic,
                "content": content,
                "tokens_used": tokens_used,
                "created_at": now
            }
            
            self.supabase.table("study_materials").insert(material_data).execute()
            
            response_data = {
                "id": material_id,
                "session_id": session_id,
                "topic": topic,
                "count": count,
                "format": format,
                "created_at": now
            }
            
            # Add parsed flashcards if available, otherwise raw content
            if flashcards_data:
                response_data["flashcards"] = flashcards_data.get("flashcards", [])
            else:
                response_data["content"] = content
            
            return response_data
            
        except Exception as e:
            logger.error(f"Failed to generate flashcards: {str(e)}")
            raise
    
    async def generate_mcq(
        self,
        user_id: str,
        topic: str,
        session_id: Optional[str] = None,
        format: str = "interactive",
        count: int = 5
    ) -> Dict[str, Any]:
        """
        Generate multiple choice questions for a topic
        
        Args:
            user_id: User's unique identifier
            topic: Topic to generate MCQs for
            session_id: Optional existing session ID
            format: Output format
            count: Number of MCQs to generate (default: 5, max: 20)
            
        Returns:
            Generated MCQ data
        """
        try:
            # Validate count
            count = max(1, min(count, 20))  # Between 1 and 20
            
            if not session_id:
                session = await self.create_session(user_id, "mcq", f"MCQ: {topic}")
                session_id = session["id"]
            
            within_limits = await self.rate_limiter.check_rate_limit(user_id, "mcq")
            if not within_limits:
                raise Exception("Rate limit exceeded")
            
            system_prompt = f"""You are a medical education expert. Generate EXACTLY {count} multiple choice questions in this EXACT format:

Question 1: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter]
Explanation: [Why this is correct]

Question 2: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter]
Explanation: [Why this is correct]

CRITICAL RULES:
- Generate EXACTLY {count} questions
- Each question MUST have exactly 4 options (A, B, C, D)
- MUST include "Correct Answer: [Letter]" line
- MUST include "Explanation: [text]" line
- Use consistent formatting for all questions
- Questions should test understanding, not just memorization
- Make questions clinically relevant and evidence-based"""
            
            prompt = f"Generate {count} multiple choice questions about: {topic}"
            
            provider = await self.model_router.select_provider("mcq")
            result = await self.model_router.execute_with_fallback(
                provider=provider,
                feature="mcq",
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            # Extract content from result
            content = result.get("content", "") if isinstance(result, dict) else str(result)
            tokens_used = result.get("tokens_used", 150) if isinstance(result, dict) else 150
            
            await self.rate_limiter.increment_usage(user_id, tokens=tokens_used, feature="mcq")
            
            material_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            material_data = {
                "id": material_id,
                "session_id": session_id,
                "feature": "mcq",
                "topic": topic,
                "content": content,
                "tokens_used": tokens_used,
                "created_at": now
            }
            
            self.supabase.table("study_materials").insert(material_data).execute()
            
            return {
                "id": material_id,
                "session_id": session_id,
                "topic": topic,
                "content": content,
                "count": count,
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
            result = await self.model_router.execute_with_fallback(
                provider=provider,
                feature="chat",
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            # Extract content from result
            content = result.get("content", "") if isinstance(result, dict) else str(result)
            tokens_used = result.get("tokens_used", 100) if isinstance(result, dict) else 100
            
            await self.rate_limiter.increment_usage(user_id, tokens=tokens_used, feature="chat")
            
            material_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            material_data = {
                "id": material_id,
                "session_id": session_id,
                "feature": "highyield",
                "topic": topic,
                "content": content,
                "tokens_used": tokens_used,
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
            result = await self.model_router.execute_with_fallback(
                provider=provider,
                feature="chat",
                prompt=prompt,
                system_prompt=system_prompt
            )
            
            # Extract content from result
            content = result.get("content", "") if isinstance(result, dict) else str(result)
            tokens_used = result.get("tokens_used", 150) if isinstance(result, dict) else 150
            
            await self.rate_limiter.increment_usage(user_id, tokens=tokens_used, feature="chat")
            
            material_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            
            material_data = {
                "id": material_id,
                "session_id": session_id,
                "feature": "explain",
                "topic": topic,
                "content": content,
                "tokens_used": tokens_used,
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
