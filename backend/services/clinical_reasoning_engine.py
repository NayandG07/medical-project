"""
Clinical Reasoning Engine Service
Production-grade service for clinical case management, OSCE simulations, and performance evaluation
"""
import os
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from supabase import Client, create_client
from dotenv import load_dotenv
from enum import Enum

load_dotenv()


class CaseType(str, Enum):
    CLINICAL_REASONING = "clinical_reasoning"
    OSCE = "osce"
    DIAGNOSTIC_CHALLENGE = "diagnostic_challenge"


class Difficulty(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class ReasoningStepType(str, Enum):
    PROBLEM_REPRESENTATION = "problem_representation"
    DIFFERENTIAL_GENERATION = "differential_generation"
    DIAGNOSTIC_JUSTIFICATION = "diagnostic_justification"
    INVESTIGATION_PLANNING = "investigation_planning"
    FINAL_DIAGNOSIS = "final_diagnosis"
    MANAGEMENT_PLAN = "management_plan"
    HISTORY_QUESTION = "history_question"
    EXAMINATION_REQUEST = "examination_request"
    INVESTIGATION_REQUEST = "investigation_request"
    CLARIFICATION_REQUEST = "clarification_request"


class OSCEScenarioType(str, Enum):
    HISTORY_TAKING = "history_taking"
    PHYSICAL_EXAMINATION = "physical_examination"
    COMMUNICATION_SKILLS = "communication_skills"
    CLINICAL_PROCEDURE = "clinical_procedure"
    DATA_INTERPRETATION = "data_interpretation"
    COUNSELING = "counseling"
    EMERGENCY_MANAGEMENT = "emergency_management"


# Medical specialties
SPECIALTIES = [
    "general_medicine", "cardiology", "pulmonology", "gastroenterology",
    "neurology", "nephrology", "endocrinology", "rheumatology",
    "infectious_disease", "hematology", "oncology", "dermatology",
    "psychiatry", "pediatrics", "obstetrics_gynecology", "surgery",
    "orthopedics", "emergency_medicine", "critical_care"
]


class ClinicalReasoningEngine:
    """Production-grade Clinical Reasoning Engine"""
    
    def __init__(self, supabase_client: Optional[Client] = None):
        if supabase_client:
            self.supabase = supabase_client
        else:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
            self.supabase = create_client(supabase_url, supabase_key)
    
    # =========================================================================
    # CASE GENERATION
    # =========================================================================
    
    async def generate_clinical_case(
        self,
        user_id: str,
        specialty: str = "general_medicine",
        difficulty: str = "intermediate",
        case_type: str = "clinical_reasoning"
    ) -> Dict[str, Any]:
        """Generate a structured clinical case with progressive disclosure"""
        from services.model_router import get_model_router_service
        
        router = get_model_router_service(self.supabase)
        
        prompt = self._build_case_generation_prompt(specialty, difficulty)
        
        provider = await router.select_provider("clinical")
        result = await router.execute_with_fallback(
            provider=provider,
            feature="clinical",
            prompt=prompt,
            system_prompt=self._get_case_generation_system_prompt()
        )
        
        if not result["success"]:
            raise Exception(f"Case generation failed: {result.get('error')}")
        
        case_data = self._parse_json_response(result["content"])
        
        # Create case record
        case_record = {
            "user_id": user_id,
            "case_type": case_type,
            "specialty": specialty,
            "difficulty": difficulty,
            "status": "in_progress",
            "patient_demographics": case_data.get("demographics", {}),
            "chief_complaint": case_data.get("chief_complaint", ""),
            "history_of_present_illness": case_data.get("hpi", {}),
            "past_medical_history": case_data.get("pmh", {}),
            "family_history": case_data.get("family_history", {}),
            "social_history": case_data.get("social_history", {}),
            "physical_examination": case_data.get("physical_exam", {}),
            "vital_signs": case_data.get("vitals", {}),
            "initial_investigations": case_data.get("initial_investigations", {}),
            "stages": case_data.get("stages", []),
            "differential_diagnoses": case_data.get("differentials", []),
            "final_diagnosis": case_data.get("final_diagnosis", ""),
            "diagnosis_explanation": case_data.get("explanation", ""),
            "management_plan": case_data.get("management", {}),
            "red_flags": case_data.get("red_flags", []),
            "clinical_pearls": case_data.get("clinical_pearls", []),
            "time_started": datetime.now(timezone.utc).isoformat()
        }
        
        response = self.supabase.table("clinical_cases").insert(case_record).execute()
        
        if not response.data:
            raise Exception("Failed to create clinical case")
        
        created_case = response.data[0]
        
        # Initialize user performance record if not exists
        await self._ensure_performance_record(user_id)
        
        # Return case without revealing answers
        return self._sanitize_case_for_user(created_case)
    
    def _build_case_generation_prompt(self, specialty: str, difficulty: str) -> str:
        complexity_guidelines = {
            "beginner": "straightforward presentation, classic findings, single diagnosis",
            "intermediate": "some atypical features, 3-4 reasonable differentials",
            "advanced": "complex presentation, comorbidities, requires systematic approach",
            "expert": "rare condition or atypical presentation, diagnostic uncertainty"
        }
        
        return f"""Generate a realistic clinical case for MBBS students in {specialty} at {difficulty} level.
        
Complexity: {complexity_guidelines.get(difficulty, complexity_guidelines["intermediate"])}

Generate a JSON response with this EXACT structure:
{{
  "demographics": {{
    "age": 45,
    "sex": "female",
    "occupation": "teacher",
    "risk_factors": ["hypertension", "obesity"]
  }},
  "chief_complaint": "chest pain for 2 hours",
  "hpi": {{
    "onset": "sudden, 2 hours ago",
    "location": "central chest",
    "character": "crushing, pressure-like",
    "radiation": "left arm and jaw",
    "severity": "9/10",
    "timing": "constant since onset",
    "aggravating_factors": ["exertion"],
    "relieving_factors": ["rest, sublingual GTN"],
    "associated_symptoms": ["diaphoresis", "nausea"]
  }},
  "pmh": {{
    "conditions": ["hypertension - 10 years", "type 2 diabetes - 5 years"],
    "medications": ["metformin 500mg BD", "amlodipine 5mg OD"],
    "allergies": ["penicillin - rash"],
    "surgical_history": ["appendectomy 2010"]
  }},
  "family_history": {{
    "relevant": ["father - MI at age 55", "mother - diabetes"]
  }},
  "social_history": {{
    "smoking": "20 pack-years, quit 2 years ago",
    "alcohol": "occasional",
    "occupation": "sedentary desk job",
    "living_situation": "lives with spouse"
  }},
  "vitals": {{
    "bp": "160/95 mmHg",
    "hr": "98 bpm, regular",
    "rr": "20/min",
    "temp": "37.0°C",
    "spo2": "96% on room air"
  }},
  "physical_exam": {{
    "general": "anxious, diaphoretic, clutching chest",
    "cardiovascular": "S1 S2 present, S4 gallop, no murmurs",
    "respiratory": "bilateral fine crackles at bases",
    "abdominal": "soft, non-tender",
    "neurological": "alert, oriented, no focal deficits"
  }},
  "initial_investigations": {{
    "ecg": "ST elevation in V1-V4, reciprocal changes in II, III, aVF",
    "troponin": "elevated at 2.5 ng/mL (normal <0.04)",
    "cbc": "Hb 13.5, WBC 12.0, platelets 250",
    "metabolic": "glucose 180, creatinine 1.2, K 4.2"
  }},
  "stages": [
    {{"stage": 1, "title": "Initial Presentation", "content": "Patient presents with chief complaint...", "question": "What additional history would you like to obtain?"}},
    {{"stage": 2, "title": "History Completed", "content": "Full history reveals...", "question": "What examination findings would you expect?"}},
    {{"stage": 3, "title": "Examination Completed", "content": "Physical examination shows...", "question": "What is your problem representation?"}},
    {{"stage": 4, "title": "Problem Representation", "content": "Synthesizing findings...", "question": "What are your differential diagnoses?"}},
    {{"stage": 5, "title": "Initial Investigations", "content": "Results show...", "question": "What is your working diagnosis and immediate management?"}},
    {{"stage": 6, "title": "Final Assessment", "content": "Complete case synthesis", "question": "Present your final diagnosis and comprehensive management plan"}}
  ],
  "differentials": [
    {{"diagnosis": "STEMI - Anterior wall MI", "likelihood": "most likely", "supporting": ["classic symptoms", "ECG changes", "elevated troponin"]}},
    {{"diagnosis": "Unstable angina", "likelihood": "less likely", "supporting": ["chest pain"], "against": ["ECG changes", "troponin elevation"]}},
    {{"diagnosis": "Aortic dissection", "likelihood": "unlikely", "supporting": ["chest pain", "hypertension"], "against": ["ECG changes", "no BP differential"]}}
  ],
  "final_diagnosis": "ST-Elevation Myocardial Infarction (STEMI) - Anterior wall",
  "explanation": "This patient presents with classic features of anterior STEMI including crushing central chest pain with radiation, diaphoresis, ECG showing ST elevation in V1-V4, and significantly elevated troponin. The anterior wall involvement indicates LAD territory.",
  "management": {{
    "immediate": ["activate cath lab", "dual antiplatelet therapy", "anticoagulation", "pain management"],
    "definitive": ["primary PCI within 90 minutes door-to-balloon"],
    "monitoring": ["continuous ECG", "serial troponins", "hemodynamic monitoring"],
    "secondary_prevention": ["statin", "ACE inhibitor", "cardiac rehabilitation"]
  }},
  "red_flags": ["ST elevation indicates ongoing myocardial damage - time critical", "signs of heart failure (crackles)", "high risk patient profile"],
  "clinical_pearls": ["Time is muscle - every minute of delay increases infarct size", "Anterior STEMI has higher mortality than inferior", "S4 gallop indicates diastolic dysfunction"]
}}

Ensure the case is medically accurate, educational, and appropriate for {difficulty} level students."""

    def _get_case_generation_system_prompt(self) -> str:
        return """You are a senior clinical educator and medical education specialist creating clinical cases for MBBS students. 

Your cases must be:
1. Medically accurate and evidence-based
2. Educationally valuable with clear learning objectives
3. Realistic with consistent findings throughout
4. Appropriate for the specified difficulty level
5. Include important red flags and clinical pearls

Always respond with valid JSON only. No markdown formatting or explanation text."""

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """Extract and parse JSON from AI response"""
        content = content.strip()
        
        if "```json" in content:
            start = content.find("```json") + 7
            end = content.find("```", start)
            content = content[start:end].strip()
        elif "```" in content:
            start = content.find("```") + 3
            end = content.find("```", start)
            content = content[start:end].strip()
        
        return json.loads(content)
    
    def _sanitize_case_for_user(self, case: Dict[str, Any]) -> Dict[str, Any]:
        """Remove answer fields from case before sending to user"""
        sanitized = dict(case)
        # Remove answer fields
        for field in ["differential_diagnoses", "final_diagnosis", "diagnosis_explanation", 
                      "management_plan", "red_flags", "clinical_pearls"]:
            sanitized.pop(field, None)
        return sanitized
    
    # =========================================================================
    # CASE PROGRESSION
    # =========================================================================
    
    async def get_case_stage(self, case_id: str, user_id: str) -> Dict[str, Any]:
        """Get current stage information for a case"""
        response = self.supabase.table("clinical_cases")\
            .select("*")\
            .eq("id", case_id)\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        
        if not response.data:
            raise Exception("Case not found")
        
        case = response.data
        stages = case.get("stages", [])
        current_stage = case.get("current_stage", 0)
        
        if current_stage >= len(stages):
            return {
                "case_id": case_id,
                "completed": True,
                "stage_data": None,
                "total_stages": len(stages)
            }
        
        # Build visible case data based on current stage
        visible_data = self._build_visible_case_data(case, current_stage)
        
        return {
            "case_id": case_id,
            "completed": False,
            "current_stage": current_stage,
            "stage_data": stages[current_stage],
            "total_stages": len(stages),
            "visible_case_data": visible_data,
            "progress_percentage": round((current_stage / len(stages)) * 100)
        }
    
    def _build_visible_case_data(self, case: Dict[str, Any], stage: int) -> Dict[str, Any]:
        """Build case data visible at current stage (progressive disclosure)"""
        visible = {
            "patient_demographics": case.get("patient_demographics", {}),
            "chief_complaint": case.get("chief_complaint", "")
        }
        
        if stage >= 1:
            visible["history_of_present_illness"] = case.get("history_of_present_illness", {})
        if stage >= 2:
            visible["past_medical_history"] = case.get("past_medical_history", {})
            visible["family_history"] = case.get("family_history", {})
            visible["social_history"] = case.get("social_history", {})
        if stage >= 3:
            visible["vital_signs"] = case.get("vital_signs", {})
            visible["physical_examination"] = case.get("physical_examination", {})
        if stage >= 4:
            visible["initial_investigations"] = case.get("initial_investigations", {})
        
        return visible
    
    async def submit_reasoning_step(
        self,
        case_id: str,
        user_id: str,
        step_type: str,
        user_input: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Submit and evaluate a reasoning step"""
        from services.model_router import get_model_router_service
        
        # Get case data
        case_response = self.supabase.table("clinical_cases")\
            .select("*")\
            .eq("id", case_id)\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        
        if not case_response.data:
            raise Exception("Case not found")
        
        case = case_response.data
        current_stage = case.get("current_stage", 0)
        
        # Count existing steps
        steps_response = self.supabase.table("clinical_reasoning_steps")\
            .select("id")\
            .eq("case_id", case_id)\
            .execute()
        
        step_number = len(steps_response.data) + 1
        
        # Evaluate the response
        router = get_model_router_service(self.supabase)
        evaluation = await self._evaluate_reasoning_step(
            router, case, step_type, user_input, current_stage
        )
        
        # Store the step
        step_record = {
            "case_id": case_id,
            "user_id": user_id,
            "step_type": step_type,
            "step_number": step_number,
            "user_input": user_input,
            "user_notes": notes,
            "ai_evaluation": evaluation,
            "score": evaluation.get("score", 0)
        }
        
        self.supabase.table("clinical_reasoning_steps").insert(step_record).execute()
        
        # Check if should advance stage
        should_advance = evaluation.get("advance_stage", False)
        if should_advance:
            new_stage = current_stage + 1
            self.supabase.table("clinical_cases")\
                .update({"current_stage": new_stage})\
                .eq("id", case_id)\
                .execute()
        
        return {
            "evaluation": evaluation,
            "step_number": step_number,
            "stage_advanced": should_advance
        }
    
    async def _evaluate_reasoning_step(
        self,
        router,
        case: Dict[str, Any],
        step_type: str,
        user_input: str,
        current_stage: int
    ) -> Dict[str, Any]:
        """Evaluate a user's reasoning step using AI"""
        
        prompt = f"""Evaluate this medical student's clinical reasoning response.

CASE CONTEXT:
Chief Complaint: {case.get('chief_complaint')}
Current Stage: {current_stage + 1}
Specialty: {case.get('specialty')}
Difficulty: {case.get('difficulty')}

STEP TYPE: {step_type}

STUDENT'S RESPONSE:
{user_input}

EVALUATION CRITERIA:
1. Clinical accuracy and appropriateness
2. Systematic approach and logical reasoning
3. Consideration of key differentials
4. Recognition of red flags
5. Evidence-based thinking

Provide evaluation as JSON:
{{
  "score": 85,
  "feedback": "Overall assessment of the response",
  "strengths": ["Point 1", "Point 2"],
  "improvements": ["Area 1", "Area 2"],
  "missed_points": ["Important consideration missed"],
  "model_answer": "The ideal response would include...",
  "advance_stage": true,
  "clinical_tips": ["Teaching point 1"]
}}

Be constructive but rigorous. Score 0-100."""

        provider = await router.select_provider("clinical")
        result = await router.execute_with_fallback(
            provider=provider,
            feature="clinical",
            prompt=prompt,
            system_prompt="You are a senior clinical examiner evaluating medical students. Provide constructive, evidence-based feedback. Respond with JSON only."
        )
        
        if not result["success"]:
            return {"score": 50, "feedback": "Evaluation error", "advance_stage": True}
        
        try:
            return self._parse_json_response(result["content"])
        except:
            return {"score": 50, "feedback": result["content"], "advance_stage": True}
    
    # =========================================================================
    # OSCE SIMULATION
    # =========================================================================
    
    async def create_osce_scenario(
        self,
        user_id: str,
        scenario_type: str = "history_taking",
        specialty: str = "general_medicine",
        difficulty: str = "intermediate"
    ) -> Dict[str, Any]:
        """Create an OSCE examination scenario"""
        from services.model_router import get_model_router_service
        
        router = get_model_router_service(self.supabase)
        
        prompt = self._build_osce_generation_prompt(scenario_type, specialty, difficulty)
        
        provider = await router.select_provider("osce")
        result = await router.execute_with_fallback(
            provider=provider,
            feature="osce",
            prompt=prompt,
            system_prompt="You are an OSCE examiner creating structured clinical examination scenarios. Respond with valid JSON only."
        )
        
        if not result["success"]:
            raise Exception(f"OSCE generation failed: {result.get('error')}")
        
        scenario_data = self._parse_json_response(result["content"])
        
        scenario_record = {
            "user_id": user_id,
            "scenario_type": scenario_type,
            "specialty": specialty,
            "difficulty": difficulty,
            "status": "in_progress",
            "candidate_instructions": scenario_data.get("candidate_instructions", ""),
            "time_limit_seconds": scenario_data.get("time_limit", 480),
            "patient_info": scenario_data.get("patient_info", {}),
            "patient_script": scenario_data.get("patient_script", {}),
            "examiner_checklist": scenario_data.get("checklist", []),
            "expected_actions": scenario_data.get("expected_actions", []),
            "time_started": datetime.now(timezone.utc).isoformat()
        }
        
        response = self.supabase.table("osce_scenarios").insert(scenario_record).execute()
        
        if not response.data:
            raise Exception("Failed to create OSCE scenario")
        
        await self._ensure_performance_record(user_id)
        
        return self._sanitize_osce_for_user(response.data[0])
    
    def _build_osce_generation_prompt(self, scenario_type: str, specialty: str, difficulty: str) -> str:
        return f"""Generate an OSCE scenario for {scenario_type} in {specialty} at {difficulty} level.

Create JSON with this structure:
{{
  "candidate_instructions": "You have 8 minutes. Take a focused history from this 45-year-old woman presenting with chest pain. Summarize your findings to the examiner.",
  "time_limit": 480,
  "patient_info": {{
    "name": "Mrs. Sarah Jones",
    "age": 45,
    "gender": "female",
    "presenting_complaint": "chest pain",
    "appearance": "middle-aged woman, appears anxious"
  }},
  "patient_script": {{
    "opening": "Doctor, I've been having this terrible pain in my chest",
    "responses": {{
      "location": "It's right here in the center of my chest",
      "character": "It feels like a heavy pressure, like something sitting on my chest",
      "duration": "It started about 2 hours ago",
      "radiation": "Now that you mention it, my left arm has been aching too"
    }}
  }},
  "checklist": [
    {{"item": "Introduces self and confirms patient identity", "points": 1, "category": "communication", "critical": false}},
    {{"item": "Asks about pain character using SOCRATES", "points": 2, "category": "history", "critical": true}},
    {{"item": "Asks about associated symptoms", "points": 2, "category": "history", "critical": true}},
    {{"item": "Asks about cardiac risk factors", "points": 2, "category": "history", "critical": true}},
    {{"item": "Asks about medications and allergies", "points": 1, "category": "history", "critical": false}},
    {{"item": "Summarizes findings accurately", "points": 2, "category": "synthesis", "critical": true}}
  ],
  "expected_actions": [
    "Professional introduction and consent",
    "Systematic history using appropriate framework",
    "Exploration of red flag symptoms",
    "Clear summarization of findings"
  ]
}}

Make the scenario realistic and educationally valuable."""

    def _sanitize_osce_for_user(self, scenario: Dict[str, Any]) -> Dict[str, Any]:
        """Remove examiner-only fields from scenario"""
        sanitized = dict(scenario)
        sanitized.pop("examiner_checklist", None)
        sanitized.pop("expected_actions", None)
        return sanitized
    
    async def osce_interaction(
        self,
        scenario_id: str,
        user_id: str,
        user_action: str
    ) -> Dict[str, Any]:
        """Process an OSCE interaction and generate patient/examiner response"""
        from services.model_router import get_model_router_service
        
        # Get scenario
        response = self.supabase.table("osce_scenarios")\
            .select("*")\
            .eq("id", scenario_id)\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        
        if not response.data:
            raise Exception("Scenario not found")
        
        scenario = response.data
        interaction_history = scenario.get("interaction_history", [])
        
        router = get_model_router_service(self.supabase)
        
        prompt = f"""You are simulating an OSCE patient and examiner.

SCENARIO: {scenario.get('scenario_type')}
PATIENT INFO: {json.dumps(scenario.get('patient_info', {}))}
PATIENT SCRIPT: {json.dumps(scenario.get('patient_script', {}))}

RECENT INTERACTIONS:
{json.dumps(interaction_history[-5:], indent=2) if interaction_history else "None yet"}

STUDENT'S ACTION:
{user_action}

Respond as JSON:
{{
  "patient_response": "What the patient says/does in response",
  "examiner_notes": "Internal assessment of student's action",
  "checklist_triggered": ["list of checklist items this action satisfies"],
  "feedback_if_needed": null
}}

Stay in character as the patient. Respond naturally and realistically."""

        provider = await router.select_provider("osce")
        result = await router.execute_with_fallback(
            provider=provider,
            feature="osce",
            prompt=prompt,
            system_prompt="You are simulating an OSCE examination. Respond as a realistic patient. JSON only."
        )
        
        if not result["success"]:
            return {"patient_response": "I'm not sure what you mean, doctor.", "error": True}
        
        try:
            interaction_data = self._parse_json_response(result["content"])
        except:
            interaction_data = {"patient_response": result["content"]}
        
        # Update interaction history
        interaction_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "student": user_action,
            "patient": interaction_data.get("patient_response", ""),
            "checklist_items": interaction_data.get("checklist_triggered", [])
        })
        
        self.supabase.table("osce_scenarios")\
            .update({"interaction_history": interaction_history})\
            .eq("id", scenario_id)\
            .execute()
        
        return {
            "patient_response": interaction_data.get("patient_response", ""),
            "feedback": interaction_data.get("feedback_if_needed")
        }
    
    # =========================================================================
    # PERFORMANCE TRACKING
    # =========================================================================
    
    async def _ensure_performance_record(self, user_id: str):
        """Ensure user has a performance record"""
        response = self.supabase.table("clinical_performance")\
            .select("id")\
            .eq("user_id", user_id)\
            .execute()
        
        if not response.data:
            self.supabase.table("clinical_performance").insert({
                "user_id": user_id
            }).execute()
    
    async def get_performance_summary(self, user_id: str) -> Dict[str, Any]:
        """Get user's clinical performance summary"""
        # Get performance record
        perf_response = self.supabase.table("clinical_performance")\
            .select("*")\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        
        # Get recent cases
        cases_response = self.supabase.table("clinical_cases")\
            .select("id, specialty, difficulty, status, created_at")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(10)\
            .execute()
        
        # Get recent OSCE
        osce_response = self.supabase.table("osce_scenarios")\
            .select("id, scenario_type, difficulty, status, created_at")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(10)\
            .execute()
        
        return {
            "performance": perf_response.data if perf_response.data else {},
            "recent_cases": cases_response.data or [],
            "recent_osce": osce_response.data or [],
            "recommendations": await self._generate_recommendations(user_id)
        }
    
    async def _generate_recommendations(self, user_id: str) -> List[str]:
        """Generate study recommendations based on performance"""
        # Get weak areas from steps with low scores
        steps_response = self.supabase.table("clinical_reasoning_steps")\
            .select("step_type, score")\
            .eq("user_id", user_id)\
            .lt("score", 60)\
            .execute()
        
        weak_areas = set()
        for step in (steps_response.data or []):
            weak_areas.add(step.get("step_type", ""))
        
        recommendations = []
        if "differential_generation" in weak_areas:
            recommendations.append("Practice systematic differential diagnosis generation")
        if "diagnostic_justification" in weak_areas:
            recommendations.append("Focus on evidence-based diagnostic reasoning")
        if "management_plan" in weak_areas:
            recommendations.append("Review management guidelines for common conditions")
        
        if not recommendations:
            recommendations.append("Continue practicing to maintain your clinical skills")
        
        return recommendations
    
    async def complete_case(self, case_id: str, user_id: str) -> Dict[str, Any]:
        """Complete a case and calculate final score"""
        # Get all steps for this case
        steps_response = self.supabase.table("clinical_reasoning_steps")\
            .select("*")\
            .eq("case_id", case_id)\
            .eq("user_id", user_id)\
            .execute()
        
        steps = steps_response.data or []
        
        # Calculate average score
        if steps:
            avg_score = sum(s.get("score", 0) for s in steps) / len(steps)
        else:
            avg_score = 0
        
        # Update case status
        self.supabase.table("clinical_cases")\
            .update({
                "status": "completed",
                "time_completed": datetime.now(timezone.utc).isoformat()
            })\
            .eq("id", case_id)\
            .execute()
        
        # Get case with answers for feedback
        case_response = self.supabase.table("clinical_cases")\
            .select("*")\
            .eq("id", case_id)\
            .single()\
            .execute()
        
        case = case_response.data
        
        # Update performance record
        self.supabase.rpc("increment_cases_completed", {"p_user_id": user_id}).execute()
        
        return {
            "final_score": round(avg_score, 1),
            "steps_completed": len(steps),
            "final_diagnosis": case.get("final_diagnosis"),
            "explanation": case.get("diagnosis_explanation"),
            "clinical_pearls": case.get("clinical_pearls", []),
            "red_flags": case.get("red_flags", [])
        }


# Singleton
_engine_instance = None

def get_clinical_reasoning_engine(supabase_client: Optional[Client] = None) -> ClinicalReasoningEngine:
    global _engine_instance
    if _engine_instance is None or supabase_client is not None:
        _engine_instance = ClinicalReasoningEngine(supabase_client)
    return _engine_instance
