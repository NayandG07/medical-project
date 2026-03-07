"""
Clinical Reasoning Service
Handles clinical case generation, progressive presentation, and performance evaluation
Requirements: 5.1, 5.3, 5.5
"""
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from supabase import Client, create_client
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()


class ClinicalService:
    """Clinical service for managing clinical reasoning cases and OSCE simulations"""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        """
        Initialize the clinical service
        
        Args:
            supabase_client: Optional Supabase client for dependency injection
        """
        if supabase_client:
            self.supabase = supabase_client
        else:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
            self.supabase = create_client(supabase_url, supabase_key)
    
    async def create_clinical_case(
        self, 
        user_id: str,
        specialty: Optional[str] = None,
        difficulty: str = "intermediate"
    ) -> Dict[str, Any]:
        """
        Generate a patient case for clinical reasoning practice
        
        Uses the model router to generate realistic patient cases with progressive
        information disclosure. Cases include chief complaint, history, examination
        findings, and diagnostic challenges.
        
        Args:
            user_id: User's unique identifier
            specialty: Optional medical specialty (cardiology, neurology, etc.)
            difficulty: Case difficulty level (beginner, intermediate, advanced)
            
        Returns:
            Dict containing:
                - case_id: Unique case identifier
                - chief_complaint: Initial patient presentation
                - stages: List of progressive information stages
                - current_stage: Current stage index (starts at 0)
                - user_id: User identifier
                - created_at: Timestamp
                
        Raises:
            Exception: If case generation fails
            
        Requirements: 5.1
        """
        try:
            from services.model_router import get_model_router_service
            
            router = get_model_router_service(self.supabase)
            
            # Build prompt for case generation with medical grounding
            specialty_text = f" in {specialty}" if specialty else ""
            
            prompt = f"""Generate a realistic medical case{specialty_text} for MBBS students practicing clinical reasoning at {difficulty} level.

The case should be structured for progressive disclosure with the following stages:
1. Chief Complaint: Brief initial presentation
2. History of Present Illness: Detailed symptom history with timeline
3. Past Medical History: Relevant medical background, medications, allergies
4. Physical Examination: Key examination findings with vital signs
5. Initial Investigations: Basic lab/imaging results with normal ranges
6. Differential Diagnosis Challenge: Ask for differential diagnosis with reasoning
7. Further Investigations: Additional test results to narrow diagnosis
8. Final Diagnosis: Correct diagnosis with pathophysiology explanation and management

Requirements:
- Use realistic clinical presentations based on evidence-based medicine
- Include appropriate medical terminology and clinical reasoning cues
- Make findings consistent with the final diagnosis
- Include relevant red flags and clinical pearls
- Align with MBBS curriculum and medical licensing exam standards
- Provide educational value for clinical practice

Format the response as JSON with this structure:
{{
  "chief_complaint": "Brief initial presentation",
  "stages": [
    {{"stage": 1, "title": "Chief Complaint", "content": "...", "question": "What would you like to know next?"}},
    {{"stage": 2, "title": "History of Present Illness", "content": "...", "question": "..."}},
    ...
  ]
}}

Make the case realistic, educational, and clinically relevant for medical students."""
            
            # Select provider for clinical feature
            provider = await router.select_provider("clinical")
            
            # Execute request with automatic fallback
            result = await router.execute_with_fallback(
                provider=provider,
                feature="clinical",
                prompt=prompt,
                system_prompt="You are a medical education specialist and experienced clinician creating clinical cases for MBBS students. Generate realistic, evidence-based cases with progressive information disclosure that teach clinical reasoning, diagnostic thinking, and evidence-based medicine. Focus on cases that are educationally valuable and aligned with medical licensing exam standards."
            )
            
            if not isinstance(result, dict) or not result.get("success", False):
                error_msg = result.get("error", "Unknown error") if isinstance(result, dict) else str(result)
                raise Exception(f"Failed to generate clinical case: {error_msg}")
            
            # Parse the generated case
            try:
                # Try to extract JSON from the response
                content = result["content"]
                
                # Log the raw content for debugging
                logger.info(f"Raw AI response length: {len(content)} chars")
                logger.debug(f"Raw AI response: {content[:500]}...")
                
                # Find JSON in the response (it might be wrapped in markdown code blocks)
                if "```json" in content:
                    json_start = content.find("```json") + 7
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                elif "```" in content:
                    json_start = content.find("```") + 3
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                
                # Try to parse JSON
                try:
                    case_data = json.loads(content)
                except json.JSONDecodeError as json_err:
                    # Log the problematic content
                    logger.error(f"JSON parsing failed. Content: {content[:1000]}")
                    logger.error(f"JSON error: {str(json_err)}")
                    raise Exception(f"Failed to parse AI response as JSON. The AI returned invalid JSON format. Error: {str(json_err)}")
                
                # Validate required fields
                if "chief_complaint" not in case_data or "stages" not in case_data:
                    logger.error(f"Missing required fields. Keys present: {list(case_data.keys())}")
                    raise ValueError("Generated case missing required fields (chief_complaint or stages)")
                
                # Create case record
                case_record = {
                    "user_id": user_id,
                    "case_type": "clinical_reasoning",
                    "specialty": specialty,
                    "difficulty": difficulty,
                    "chief_complaint": case_data["chief_complaint"],
                    "stages": case_data["stages"],
                    "current_stage": 0,
                    "performance_data": {},
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Store in chat_sessions table with special metadata
                # We'll use the chat_sessions table to store clinical cases
                # and use the messages table to store interactions
                session_data = {
                    "user_id": user_id,
                    "title": f"Clinical Case: {case_data['chief_complaint'][:50]}..."
                }
                
                session_response = self.supabase.table("chat_sessions").insert(session_data).execute()
                
                if not session_response.data or len(session_response.data) == 0:
                    raise Exception("Failed to create clinical case session")
                
                session_id = session_response.data[0]["id"]
                
                # Store case data as first system message
                case_message = {
                    "session_id": session_id,
                    "role": "system",
                    "content": json.dumps(case_record),
                    "tokens_used": result["tokens_used"]
                }
                
                self.supabase.table("messages").insert(case_message).execute()
                
                # Return case with session_id
                case_record["case_id"] = session_id
                
                return case_record
                
            except json.JSONDecodeError as e:
                raise Exception(f"Failed to parse generated case as JSON: {str(e)}")
            except ValueError as e:
                raise Exception(f"Invalid case structure: {str(e)}")
                
        except Exception as e:
            raise Exception(f"Failed to create clinical case: {str(e)}")
    
    async def present_case_progressively(
        self, 
        session_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Present the next stage of a clinical case progressively
        
        Retrieves the case data and returns the next stage of information.
        Cases are presented sequentially without skipping stages.
        
        Args:
            session_id: Clinical case session identifier
            user_id: User's unique identifier
            
        Returns:
            Dict containing:
                - case_id: Case identifier
                - current_stage: Current stage index
                - stage_data: Current stage information (title, content, question)
                - has_more_stages: Whether more stages remain
                - total_stages: Total number of stages
                
        Raises:
            Exception: If case not found or retrieval fails
            
        Requirements: 5.3
        """
        try:
            # Verify session belongs to user
            session_response = self.supabase.table("chat_sessions")\
                .select("id")\
                .eq("id", session_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not session_response.data or len(session_response.data) == 0:
                raise Exception("Clinical case not found or does not belong to user")
            
            # Get case data from first system message
            messages_response = self.supabase.table("messages")\
                .select("*")\
                .eq("session_id", session_id)\
                .eq("role", "system")\
                .order("created_at", desc=False)\
                .limit(1)\
                .execute()
            
            if not messages_response.data or len(messages_response.data) == 0:
                raise Exception("Clinical case data not found")
            
            # Parse case data
            case_data = json.loads(messages_response.data[0]["content"])
            
            current_stage = case_data.get("current_stage", 0)
            stages = case_data.get("stages", [])
            
            if current_stage >= len(stages):
                # Case completed
                return {
                    "case_id": session_id,
                    "current_stage": current_stage,
                    "stage_data": None,
                    "has_more_stages": False,
                    "total_stages": len(stages),
                    "completed": True
                }
            
            # Get current stage data
            stage_data = stages[current_stage]
            
            return {
                "case_id": session_id,
                "current_stage": current_stage,
                "stage_data": stage_data,
                "has_more_stages": current_stage < len(stages) - 1,
                "total_stages": len(stages),
                "completed": False
            }
            
        except Exception as e:
            raise Exception(f"Failed to present case progressively: {str(e)}")
    
    async def advance_case_stage(
        self,
        session_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Advance the clinical case to the next stage
        
        Args:
            session_id: Clinical case session identifier
            user_id: User's unique identifier
            
        Returns:
            Dict with updated case information
            
        Raises:
            Exception: If advancement fails
        """
        try:
            # Verify session belongs to user
            session_response = self.supabase.table("chat_sessions")\
                .select("id")\
                .eq("id", session_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not session_response.data or len(session_response.data) == 0:
                raise Exception("Clinical case not found or does not belong to user")
            
            # Get case data from first system message
            messages_response = self.supabase.table("messages")\
                .select("*")\
                .eq("session_id", session_id)\
                .eq("role", "system")\
                .order("created_at", desc=False)\
                .limit(1)\
                .execute()
            
            if not messages_response.data or len(messages_response.data) == 0:
                raise Exception("Clinical case data not found")
            
            message_id = messages_response.data[0]["id"]
            case_data = json.loads(messages_response.data[0]["content"])
            
            # Increment stage
            current_stage = case_data.get("current_stage", 0)
            case_data["current_stage"] = current_stage + 1
            
            # Update case data
            self.supabase.table("messages")\
                .update({"content": json.dumps(case_data)})\
                .eq("id", message_id)\
                .execute()
            
            # Return updated presentation
            return await self.present_case_progressively(session_id, user_id)
            
        except Exception as e:
            raise Exception(f"Failed to advance case stage: {str(e)}")
    
    async def evaluate_clinical_reasoning(
        self,
        session_id: str,
        user_id: str,
        user_response: str,
        stage: int
    ) -> Dict[str, Any]:
        """
        Evaluate a user's clinical reasoning response
        
        Uses AI to evaluate the quality and accuracy of the user's clinical
        reasoning at each stage. Provides feedback and tracks performance.
        
        Args:
            session_id: Clinical case session identifier
            user_id: User's unique identifier
            user_response: User's answer or reasoning
            stage: Stage number being evaluated
            
        Returns:
            Dict containing:
                - evaluation: AI-generated evaluation text
                - score: Numerical score (0-100)
                - feedback: Specific feedback points
                - correct_answer: Model answer for comparison
                
        Raises:
            Exception: If evaluation fails
            
        Requirements: 5.5
        """
        try:
            from services.model_router import get_model_router_service
            
            # Get case data
            messages_response = self.supabase.table("messages")\
                .select("*")\
                .eq("session_id", session_id)\
                .eq("role", "system")\
                .order("created_at", desc=False)\
                .limit(1)\
                .execute()
            
            if not messages_response.data or len(messages_response.data) == 0:
                raise Exception("Clinical case data not found")
            
            case_data = json.loads(messages_response.data[0]["content"])
            stages = case_data.get("stages", [])
            
            if stage >= len(stages):
                raise Exception("Invalid stage number")
            
            stage_data = stages[stage]
            
            # Build evaluation prompt with medical grounding
            router = get_model_router_service(self.supabase)
            
            prompt = f"""Evaluate this MBBS student's clinical reasoning response using evidence-based medicine principles.

Case Context:
Chief Complaint: {case_data.get('chief_complaint', 'N/A')}
Current Stage: {stage_data.get('title', 'N/A')}
Stage Information: {stage_data.get('content', 'N/A')}
Question Asked: {stage_data.get('question', 'N/A')}

Student's Response:
{user_response}

Evaluation Criteria:
1. Clinical reasoning process and systematic approach
2. Appropriate use of medical knowledge and evidence-based medicine
3. Consideration of differential diagnoses
4. Recognition of red flags and clinical priorities
5. Application of clinical guidelines and best practices
6. Communication clarity and medical terminology usage

Please evaluate the response and provide:
1. A score from 0-100 based on clinical reasoning quality
2. Specific feedback on strengths and areas for improvement
3. The model answer demonstrating ideal clinical reasoning
4. Key learning points for the student

Format as JSON:
{{
  "score": 85,
  "evaluation": "Overall assessment of clinical reasoning...",
  "feedback": ["Strength: Good systematic approach", "Improvement: Consider additional differentials", ...],
  "model_answer": "The ideal clinical reasoning would include...",
  "learning_points": ["Key concept 1", "Key concept 2", ...]
}}"""
            
            provider = await router.select_provider("clinical")
            
            result = await router.execute_with_fallback(
                provider=provider,
                feature="clinical",
                prompt=prompt,
                system_prompt="You are a medical education specialist and experienced clinician evaluating MBBS students' clinical reasoning. Provide constructive, evidence-based feedback that helps students develop strong clinical reasoning skills. Focus on teaching clinical thinking, diagnostic approach, and evidence-based medicine principles."
            )
            
            if not isinstance(result, dict) or not result.get("success", False):
                error_msg = result.get("error", "Unknown error") if isinstance(result, dict) else str(result)
                raise Exception(f"Failed to evaluate response: {error_msg}")
            
            # Parse evaluation
            try:
                content = result["content"]
                
                # Extract JSON
                if "```json" in content:
                    json_start = content.find("```json") + 7
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                elif "```" in content:
                    json_start = content.find("```") + 3
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                
                evaluation_data = json.loads(content)
                
                # Update performance data in case
                message_id = messages_response.data[0]["id"]
                performance_data = case_data.get("performance_data", {})
                performance_data[f"stage_{stage}"] = {
                    "score": evaluation_data.get("score", 0),
                    "response": user_response,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                case_data["performance_data"] = performance_data
                
                self.supabase.table("messages")\
                    .update({"content": json.dumps(case_data)})\
                    .eq("id", message_id)\
                    .execute()
                
                return evaluation_data
                
            except json.JSONDecodeError as e:
                # If JSON parsing fails, return a basic evaluation
                return {
                    "score": 50,
                    "evaluation": result["content"],
                    "feedback": ["Response received but could not be parsed into structured feedback"],
                    "model_answer": "See evaluation text for details"
                }
                
        except Exception as e:
            raise Exception(f"Failed to evaluate clinical reasoning: {str(e)}")
    
    async def create_osce_scenario(
        self,
        user_id: str,
        scenario_type: Optional[str] = None,
        difficulty: str = "intermediate"
    ) -> Dict[str, Any]:
        """
        Generate an OSCE (Objective Structured Clinical Examination) scenario
        
        Creates a structured examination scenario with simulated patient and
        examiner interactions. Scenarios include history taking, physical
        examination, communication skills, and clinical procedures.
        
        Args:
            user_id: User's unique identifier
            scenario_type: Optional scenario type (history_taking, physical_exam, 
                          communication, procedure, etc.)
            difficulty: Scenario difficulty level (beginner, intermediate, advanced)
            
        Returns:
            Dict containing:
                - scenario_id: Unique scenario identifier
                - scenario_type: Type of OSCE station
                - patient_info: Simulated patient information
                - instructions: Candidate instructions
                - examiner_checklist: Items examiner looks for
                - user_id: User identifier
                - created_at: Timestamp
                
        Raises:
            Exception: If scenario generation fails
            
        Requirements: 5.2
        """
        try:
            from services.model_router import get_model_router_service
            
            router = get_model_router_service(self.supabase)
            
            # Build prompt for OSCE scenario generation with medical grounding
            scenario_text = f" for {scenario_type}" if scenario_type else ""
            
            prompt = f"""Generate a realistic OSCE (Objective Structured Clinical Examination) scenario{scenario_text} at {difficulty} level for MBBS students.

The scenario should include:
1. Scenario Type: Type of station (history taking, physical exam, communication, procedure)
2. Patient Information: Age, gender, presenting complaint, relevant background
3. Candidate Instructions: What the student is asked to do (8 minutes)
4. Patient Script: How the simulated patient should respond (realistic, consistent)
5. Examiner Checklist: Key items to assess with point values (aligned with OSCE standards)
6. Expected Actions: Sequence of actions demonstrating good clinical practice

Requirements:
- Use realistic clinical presentations based on common OSCE scenarios
- Include appropriate communication skills assessment
- Align with MBBS curriculum and OSCE examination standards
- Include clinical reasoning and evidence-based practice elements
- Make patient responses realistic and educationally valuable
- Include relevant clinical guidelines and best practices

Format the response as JSON:
{{
  "scenario_type": "history_taking",
  "patient_info": {{
    "age": 45,
    "gender": "female",
    "presenting_complaint": "...",
    "background": "..."
  }},
  "instructions": "You are asked to take a focused history from this patient...",
  "patient_script": {{
    "opening": "How the patient introduces themselves",
    "responses": {{
      "pain_location": "Response if asked about pain location",
      "duration": "Response if asked about duration",
      ...
    }}
  }},
  "examiner_checklist": [
    {{"item": "Introduces self and confirms patient identity", "points": 1}},
    {{"item": "Asks about pain characteristics (SOCRATES)", "points": 2}},
    ...
  ],
  "expected_actions": [
    "Introduction and rapport building",
    "Systematic history taking using appropriate framework",
    ...
  ]
}}

Make it realistic, clinically relevant, and appropriate for MBBS students."""
            
            # Select provider for OSCE feature
            provider = await router.select_provider("osce")
            
            # Execute request with automatic fallback
            result = await router.execute_with_fallback(
                provider=provider,
                feature="osce",
                prompt=prompt,
                system_prompt="You are a medical education specialist and OSCE examiner with expertise in creating structured clinical examination scenarios for MBBS students. Generate realistic, evidence-based scenarios that assess clinical skills, communication, and professional behavior. Align with OSCE examination standards and medical licensing requirements."
            )
            
            if not isinstance(result, dict) or not result.get("success", False):
                error_msg = result.get("error", "Unknown error") if isinstance(result, dict) else str(result)
                raise Exception(f"Failed to generate OSCE scenario: {error_msg}")
            
            # Parse the generated scenario
            try:
                content = result["content"]
                
                # Log the raw content for debugging
                logger.info(f"Raw OSCE AI response length: {len(content)} chars")
                logger.debug(f"Raw OSCE AI response: {content[:500]}...")
                
                # Extract JSON
                if "```json" in content:
                    json_start = content.find("```json") + 7
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                elif "```" in content:
                    json_start = content.find("```") + 3
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                
                # Try to parse JSON
                try:
                    scenario_data = json.loads(content)
                except json.JSONDecodeError as json_err:
                    # Log the problematic content
                    logger.error(f"OSCE JSON parsing failed. Content: {content[:1000]}")
                    logger.error(f"JSON error: {str(json_err)}")
                    raise Exception(f"Failed to parse OSCE AI response as JSON. The AI returned invalid JSON format. Error: {str(json_err)}")
                
                # Validate required fields
                if "scenario_type" not in scenario_data or "patient_info" not in scenario_data:
                    logger.error(f"Missing required fields. Keys present: {list(scenario_data.keys())}")
                    raise ValueError("Generated scenario missing required fields (scenario_type or patient_info)")
                
                # Create scenario record
                scenario_record = {
                    "user_id": user_id,
                    "case_type": "osce",
                    "scenario_type": scenario_data["scenario_type"],
                    "difficulty": difficulty,
                    "patient_info": scenario_data["patient_info"],
                    "instructions": scenario_data.get("instructions", ""),
                    "patient_script": scenario_data.get("patient_script", {}),
                    "examiner_checklist": scenario_data.get("examiner_checklist", []),
                    "expected_actions": scenario_data.get("expected_actions", []),
                    "interaction_history": [],
                    "performance_data": {},
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Store in chat_sessions table
                session_data = {
                    "user_id": user_id,
                    "title": f"OSCE: {scenario_data['scenario_type']} - {scenario_data['patient_info'].get('presenting_complaint', 'Scenario')[:50]}"
                }
                
                session_response = self.supabase.table("chat_sessions").insert(session_data).execute()
                
                if not session_response.data or len(session_response.data) == 0:
                    raise Exception("Failed to create OSCE scenario session")
                
                session_id = session_response.data[0]["id"]
                
                # Store scenario data as first system message
                scenario_message = {
                    "session_id": session_id,
                    "role": "system",
                    "content": json.dumps(scenario_record),
                    "tokens_used": result["tokens_used"]
                }
                
                self.supabase.table("messages").insert(scenario_message).execute()
                
                # Return scenario with session_id
                scenario_record["scenario_id"] = session_id
                
                return scenario_record
                
            except json.JSONDecodeError as e:
                raise Exception(f"Failed to parse generated scenario as JSON: {str(e)}")
            except ValueError as e:
                raise Exception(f"Invalid scenario structure: {str(e)}")
                
        except Exception as e:
            raise Exception(f"Failed to create OSCE scenario: {str(e)}")
    
    async def simulate_examiner_interaction(
        self,
        session_id: str,
        user_id: str,
        user_action: str
    ) -> Dict[str, Any]:
        """
        Simulate examiner and patient responses to user actions in OSCE
        
        Generates realistic responses from the simulated patient and provides
        examiner feedback based on the user's actions during the OSCE station.
        
        Args:
            session_id: OSCE scenario session identifier
            user_id: User's unique identifier
            user_action: User's action or question during the OSCE
            
        Returns:
            Dict containing:
                - patient_response: What the simulated patient says/does
                - examiner_observation: Examiner's internal notes
                - checklist_items_met: Which checklist items were addressed
                - feedback: Immediate feedback if appropriate
                
        Raises:
            Exception: If interaction simulation fails
            
        Requirements: 5.4
        """
        try:
            from services.model_router import get_model_router_service
            
            # Get scenario data
            messages_response = self.supabase.table("messages")\
                .select("*")\
                .eq("session_id", session_id)\
                .eq("role", "system")\
                .order("created_at", desc=False)\
                .limit(1)\
                .execute()
            
            if not messages_response.data or len(messages_response.data) == 0:
                raise Exception("OSCE scenario data not found")
            
            message_id = messages_response.data[0]["id"]
            scenario_data = json.loads(messages_response.data[0]["content"])
            
            # Build interaction prompt with medical grounding
            router = get_model_router_service(self.supabase)
            
            # Get interaction history
            interaction_history = scenario_data.get("interaction_history", [])
            history_text = "\n".join([f"- {item}" for item in interaction_history[-5:]])  # Last 5 interactions
            
            prompt = f"""You are simulating an OSCE station for an MBBS student. Generate realistic, clinically appropriate responses.

Scenario Type: {scenario_data.get('scenario_type', 'N/A')}
Patient Info: {json.dumps(scenario_data.get('patient_info', {}))}
Patient Script: {json.dumps(scenario_data.get('patient_script', {}))}
Examiner Checklist: {json.dumps(scenario_data.get('examiner_checklist', []))}

Recent Interaction History:
{history_text if history_text else "None yet"}

Student's Current Action:
{user_action}

Requirements:
- Patient responses should be realistic and consistent with the clinical scenario
- Assess student's clinical skills, communication, and professionalism
- Note which checklist items are being addressed
- Provide constructive feedback when appropriate
- Maintain clinical realism and educational value

Generate a response as JSON:
{{
  "patient_response": "What the patient says or does in response (realistic, in character)",
  "examiner_observation": "What the examiner notes about the student's performance",
  "checklist_items_met": ["List of checklist items this action addresses"],
  "feedback": "Optional immediate feedback if warranted (e.g., safety concerns)"
}}

Be realistic - patients respond naturally with appropriate emotions and body language, examiners assess objectively based on clinical standards."""
            
            provider = await router.select_provider("osce")
            
            result = await router.execute_with_fallback(
                provider=provider,
                feature="osce",
                prompt=prompt,
                system_prompt="You are simulating an OSCE examination with realistic patient and examiner responses for MBBS students. Provide clinically accurate, educationally valuable interactions that help students develop clinical skills, communication abilities, and professional behavior. Maintain realism while ensuring educational value."
            )
            
            if not isinstance(result, dict) or not result.get("success", False):
                error_msg = result.get("error", "Unknown error") if isinstance(result, dict) else str(result)
                raise Exception(f"Failed to simulate interaction: {error_msg}")
            
            # Parse response
            try:
                content = result["content"]
                
                # Extract JSON
                if "```json" in content:
                    json_start = content.find("```json") + 7
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                elif "```" in content:
                    json_start = content.find("```") + 3
                    json_end = content.find("```", json_start)
                    content = content[json_start:json_end].strip()
                
                interaction_data = json.loads(content)
                
                # Update interaction history
                interaction_history.append(f"Student: {user_action}")
                interaction_history.append(f"Patient: {interaction_data.get('patient_response', '')}")
                scenario_data["interaction_history"] = interaction_history
                
                # Update performance tracking
                performance_data = scenario_data.get("performance_data", {})
                checklist_items = interaction_data.get("checklist_items_met", [])
                if checklist_items:
                    if "checklist_progress" not in performance_data:
                        performance_data["checklist_progress"] = []
                    performance_data["checklist_progress"].extend(checklist_items)
                
                scenario_data["performance_data"] = performance_data
                
                # Update scenario data in database
                self.supabase.table("messages")\
                    .update({"content": json.dumps(scenario_data)})\
                    .eq("id", message_id)\
                    .execute()
                
                # Store user action and response as messages
                user_message = {
                    "session_id": session_id,
                    "role": "user",
                    "content": user_action,
                    "tokens_used": None
                }
                self.supabase.table("messages").insert(user_message).execute()
                
                assistant_message = {
                    "session_id": session_id,
                    "role": "assistant",
                    "content": interaction_data.get("patient_response", ""),
                    "tokens_used": result["tokens_used"]
                }
                self.supabase.table("messages").insert(assistant_message).execute()
                
                return interaction_data
                
            except json.JSONDecodeError as e:
                # If JSON parsing fails, return basic response
                return {
                    "patient_response": result["content"],
                    "examiner_observation": "Response generated but not structured",
                    "checklist_items_met": [],
                    "feedback": None
                }
                
        except Exception as e:
            raise Exception(f"Failed to simulate examiner interaction: {str(e)}")
    
    async def get_osce_performance(
        self,
        session_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Get performance summary for an OSCE scenario
        
        Args:
            session_id: OSCE scenario session identifier
            user_id: User's unique identifier
            
        Returns:
            Dict containing performance metrics and feedback
            
        Requirements: 5.5
        """
        try:
            # Verify session belongs to user
            session_response = self.supabase.table("chat_sessions")\
                .select("id")\
                .eq("id", session_id)\
                .eq("user_id", user_id)\
                .execute()
            
            if not session_response.data or len(session_response.data) == 0:
                raise Exception("OSCE scenario not found or does not belong to user")
            
            # Get scenario data
            messages_response = self.supabase.table("messages")\
                .select("*")\
                .eq("session_id", session_id)\
                .eq("role", "system")\
                .order("created_at", desc=False)\
                .limit(1)\
                .execute()
            
            if not messages_response.data or len(messages_response.data) == 0:
                raise Exception("OSCE scenario data not found")
            
            scenario_data = json.loads(messages_response.data[0]["content"])
            
            # Calculate performance
            checklist = scenario_data.get("examiner_checklist", [])
            checklist_progress = scenario_data.get("performance_data", {}).get("checklist_progress", [])
            
            total_points = sum(item.get("points", 1) for item in checklist)
            earned_points = 0
            
            for item in checklist:
                if item.get("item") in checklist_progress:
                    earned_points += item.get("points", 1)
            
            score = (earned_points / total_points * 100) if total_points > 0 else 0
            
            return {
                "scenario_id": session_id,
                "score": round(score, 1),
                "earned_points": earned_points,
                "total_points": total_points,
                "checklist_items_completed": len(set(checklist_progress)),
                "total_checklist_items": len(checklist),
                "interaction_count": len(scenario_data.get("interaction_history", [])),
                "performance_data": scenario_data.get("performance_data", {})
            }
            
        except Exception as e:
            raise Exception(f"Failed to get OSCE performance: {str(e)}")


# Singleton instance for easy import
_clinical_service_instance = None


def get_clinical_service(supabase_client: Optional[Client] = None) -> ClinicalService:
    """
    Get or create the clinical service instance
    
    Args:
        supabase_client: Optional Supabase client for dependency injection
        
    Returns:
        ClinicalService instance
    """
    global _clinical_service_instance
    if _clinical_service_instance is None or supabase_client is not None:
        _clinical_service_instance = ClinicalService(supabase_client)
    return _clinical_service_instance
