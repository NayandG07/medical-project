"""
Clinical Reasoning Engine Service
Production-grade service for clinical case management, OSCE simulations, and performance evaluation
"""
import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from supabase import Client, create_client
from dotenv import load_dotenv
from enum import Enum

load_dotenv()
logger = logging.getLogger(__name__)


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
        case_type: str = "clinical_reasoning",
        use_custom_condition: bool = False,
        custom_condition: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a structured clinical case with progressive disclosure"""
        from services.model_router import get_model_router_service
        
        router = get_model_router_service(self.supabase)
        
        prompt = self._build_case_generation_prompt(specialty, difficulty, use_custom_condition, custom_condition)
        
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
    
    def _build_case_generation_prompt(self, specialty: str, difficulty: str, use_custom_condition: bool = False, custom_condition: Optional[str] = None) -> str:
        """Build prompt for clinical case generation based on parameters"""
        
        complexity_guidelines = {
            "beginner": "straightforward presentation, classic findings, single diagnosis",
            "intermediate": "some atypical features, 3-4 reasonable differentials",
            "advanced": "complex presentation, comorbidities, requires systematic approach",
            "expert": "rare condition or atypical presentation, diagnostic uncertainty"
        }
        
        # Expanded specialty-specific conditions with more variety
        specialty_conditions = {
            "general_medicine": [
                "community-acquired pneumonia", "hospital-acquired pneumonia", "tuberculosis",
                "acute exacerbation of COPD", "acute severe asthma", "pulmonary embolism",
                "acute kidney injury", "chronic kidney disease", "nephrotic syndrome", "glomerulonephritis",
                "diabetic ketoacidosis", "hyperosmolar hyperglycemic state", "hypoglycemia",
                "hyperthyroidism", "hypothyroidism", "adrenal insufficiency",
                "acute gastroenteritis", "inflammatory bowel disease", "peptic ulcer disease", "pancreatitis",
                "stroke", "meningitis", "encephalitis", "guillain-barre syndrome",
                "infective endocarditis", "pericarditis", "myocarditis",
                "anemia", "thrombocytopenia", "leukemia", "lymphoma",
                "systemic lupus erythematosus", "rheumatoid arthritis", "vasculitis"
            ],
            "surgery": [
                "acute appendicitis", "acute cholecystitis", "acute pancreatitis",
                "bowel obstruction", "perforated peptic ulcer", "diverticulitis",
                "inguinal hernia", "femoral hernia", "incarcerated hernia",
                "testicular torsion", "epididymo-orchitis", "prostate cancer",
                "breast cancer", "thyroid nodule", "parathyroid adenoma",
                "abdominal aortic aneurysm", "peripheral arterial disease", "varicose veins",
                "head injury", "spinal cord injury", "fractures",
                "burns", "wound infection", "necrotizing fasciitis"
            ],
            "pediatrics": [
                "bronchiolitis", "croup", "epiglottitis", "pneumonia",
                "febrile seizure", "meningitis", "encephalitis",
                "gastroenteritis", "intussusception", "pyloric stenosis", "appendicitis",
                "kawasaki disease", "henoch-schonlein purpura", "nephrotic syndrome",
                "congenital heart disease", "rheumatic fever", "myocarditis",
                "diabetes mellitus type 1", "diabetic ketoacidosis",
                "developmental delay", "autism spectrum disorder", "ADHD",
                "failure to thrive", "child abuse", "neglect"
            ],
            "obs_gynecology": [
                "ectopic pregnancy", "miscarriage", "molar pregnancy",
                "hyperemesis gravidarum", "gestational diabetes", "preeclampsia", "eclampsia",
                "placenta previa", "placental abruption", "vasa previa",
                "preterm labor", "postpartum hemorrhage", "retained placenta",
                "mastitis", "postnatal depression", "puerperal psychosis",
                "ovarian cyst", "ovarian torsion", "ovarian cancer",
                "endometriosis", "adenomyosis", "uterine fibroids",
                "pelvic inflammatory disease", "cervical cancer", "endometrial cancer",
                "menorrhagia", "dysmenorrhea", "polycystic ovary syndrome"
            ],
            "psychiatry": [
                "major depressive disorder", "bipolar disorder type 1", "bipolar disorder type 2",
                "generalized anxiety disorder", "panic disorder", "social anxiety disorder",
                "obsessive-compulsive disorder", "post-traumatic stress disorder",
                "schizophrenia", "schizoaffective disorder", "delusional disorder",
                "alcohol use disorder", "opioid use disorder", "stimulant use disorder",
                "anorexia nervosa", "bulimia nervosa", "binge eating disorder",
                "borderline personality disorder", "antisocial personality disorder",
                "delirium", "dementia", "mild cognitive impairment"
            ],
            "emergency": [
                "ST-elevation myocardial infarction", "non-ST elevation myocardial infarction", "unstable angina",
                "aortic dissection", "pulmonary embolism", "cardiac tamponade",
                "anaphylaxis", "septic shock", "cardiogenic shock", "hypovolemic shock",
                "status epilepticus", "acute ischemic stroke", "hemorrhagic stroke", "subarachnoid hemorrhage",
                "major trauma", "traumatic brain injury", "spinal cord injury",
                "acute abdomen", "ruptured AAA", "mesenteric ischemia",
                "upper GI bleeding", "lower GI bleeding", "ruptured ectopic pregnancy",
                "acute limb ischemia", "compartment syndrome", "rhabdomyolysis"
            ]
        }
        
        conditions = specialty_conditions.get(specialty, specialty_conditions["general_medicine"])
        
        # Handle custom condition or random selection
        if use_custom_condition and custom_condition:
            suggested_condition = custom_condition
            condition_instruction = f"- You MUST create a case for this SPECIFIC condition: {custom_condition}"
        else:
            # Add explicit randomization
            import random
            suggested_condition = random.choice(conditions)
            condition_instruction = f"""- You MUST choose ONE condition from this list: {', '.join(conditions)}
- SUGGESTED condition for THIS case: {suggested_condition}
- DO NOT default to common conditions like MI or chest pain
- Use the FULL variety of conditions provided"""
        
        return f"""Generate a UNIQUE, realistic clinical case for MBBS students in {specialty} at {difficulty} level.

CRITICAL REQUIREMENTS:
- Specialty: {specialty}
- Difficulty: {difficulty}
- Complexity: {complexity_guidelines.get(difficulty, complexity_guidelines["intermediate"])}

CONDITION SELECTION:
{condition_instruction}
- Make each case unique and different

PATIENT VARIATION:
- Create DIFFERENT patient demographics each time
- Vary age widely (20s to 80s)
- Vary gender (male/female)
- Vary occupation and lifestyle
- Vary risk factors and comorbidities
- Make each case feel unique

CRITICAL: Generate COMPLETE JSON with ALL fields filled. Do NOT use placeholders like "...omitted for brevity..." or "..." anywhere.

Generate a JSON response with this EXACT structure (ALL fields must be complete):
{{
  "demographics": {{
    "age": "Appropriate age for condition (vary widely)",
    "sex": "male/female",
    "occupation": "Realistic occupation",
    "risk_factors": ["relevant risk factors"]
  }},
  "chief_complaint": "Main presenting complaint",
  "hpi": {{
    "onset": "When and how it started",
    "location": "Where (if applicable)",
    "character": "Nature of symptoms",
    "radiation": "If applicable",
    "severity": "Scale or description",
    "timing": "Pattern over time",
    "aggravating_factors": ["what makes it worse"],
    "relieving_factors": ["what makes it better"],
    "associated_symptoms": ["other symptoms"]
  }},
  "pmh": {{
    "conditions": ["past medical conditions with duration"],
    "medications": ["current medications with doses"],
    "allergies": ["drug allergies with reactions"],
    "surgical_history": ["past surgeries with years"]
  }},
  "family_history": {{
    "relevant": ["family conditions relevant to case"]
  }},
  "social_history": {{
    "smoking": "smoking history",
    "alcohol": "alcohol use",
    "occupation": "work details",
    "living_situation": "home situation"
  }},
  "vitals": {{
    "bp": "blood pressure",
    "hr": "heart rate with rhythm",
    "rr": "respiratory rate",
    "temp": "temperature",
    "spo2": "oxygen saturation"
  }},
  "physical_exam": {{
    "general": "general appearance",
    "cardiovascular": "CVS findings",
    "respiratory": "respiratory findings",
    "abdominal": "abdominal findings",
    "neurological": "neuro findings"
  }},
  "initial_investigations": {{
    "relevant_test_1": "result with interpretation",
    "relevant_test_2": "result with interpretation",
    "relevant_test_3": "result with interpretation"
  }},
  "stages": [
    {{"stage": 1, "title": "Initial Presentation", "content": "Patient presents with chief complaint", "question": "What additional history would you like to obtain?"}},
    {{"stage": 2, "title": "History Completed", "content": "Full history reveals details", "question": "What examination findings would you expect?"}},
    {{"stage": 3, "title": "Examination Completed", "content": "Physical examination shows findings", "question": "What is your problem representation?"}},
    {{"stage": 4, "title": "Problem Representation", "content": "Synthesizing findings", "question": "What are your differential diagnoses?"}},
    {{"stage": 5, "title": "Initial Investigations", "content": "Results show data", "question": "What is your working diagnosis and immediate management?"}},
    {{"stage": 6, "title": "Final Assessment", "content": "Complete case synthesis", "question": "Present your final diagnosis and comprehensive management plan"}}
  ],
  "differentials": [
    {{"diagnosis": "Most likely diagnosis", "likelihood": "most likely", "supporting": ["supporting features"], "against": []}},
    {{"diagnosis": "Alternative diagnosis", "likelihood": "possible", "supporting": ["some features"], "against": ["features against"]}},
    {{"diagnosis": "Less likely diagnosis", "likelihood": "unlikely", "supporting": ["minimal features"], "against": ["features against"]}}
  ],
  "final_diagnosis": "Definitive diagnosis with specifics",
  "explanation": "Clear explanation of why this is the diagnosis, linking clinical features",
  "management": {{
    "immediate": ["immediate actions"],
    "definitive": ["definitive treatment"],
    "monitoring": ["what to monitor"],
    "secondary_prevention": ["long-term management"]
  }},
  "red_flags": ["critical features requiring urgent action"],
  "clinical_pearls": ["educational points and clinical wisdom"]
}}

IMPORTANT: 
- Generate COMPLETELY DIFFERENT cases each time
- DO NOT repeat the same conditions frequently
- Use the FULL range of conditions provided
- Vary patient demographics widely
- Do NOT use "..." or "[...]" or "omitted for brevity" anywhere
- ALL arrays must have complete items (at least 2-3 items each)
- ALL strings must be complete sentences
- Generate COMPLETE, VALID JSON only
- No markdown formatting
- Make it specific to {specialty} and appropriate for {difficulty} level

CRITICAL JSON RULES:
- Use only valid escape sequences: \\", \\\\, \\/, \\b, \\f, \\n, \\r, \\t
- DO NOT use invalid escapes like \\1, \\2, etc.
- If you need to include a backslash, use \\\\
- All strings must be properly quoted
- No trailing commas
- No comments

Ensure the case is medically accurate, educational, and UNIQUE."""

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
        """Extract and parse JSON from AI response with robust error handling"""
        import re
        
        original_content = content
        content = content.strip()
        
        # Try to extract JSON from markdown code blocks
        if "```json" in content:
            start = content.find("```json") + 7
            end = content.find("```", start)
            if end != -1:
                content = content[start:end].strip()
        elif "```" in content:
            start = content.find("```") + 3
            end = content.find("```", start)
            if end != -1:
                content = content[start:end].strip()
        
        # Remove comments BEFORE extracting JSON (they might be after the JSON)
        # Remove single-line comments (// ...)
        content = re.sub(r'//.*?(?=\n|$)', '', content)
        # Remove multi-line comments (/* ... */)
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        
        # Try to find JSON object boundaries
        # Look for the first { and find its matching }
        first_brace = content.find('{')
        
        if first_brace != -1:
            # Find the matching closing brace by counting braces
            brace_count = 0
            in_string = False
            escape_next = False
            
            for i in range(first_brace, len(content)):
                char = content[i]
                
                if escape_next:
                    escape_next = False
                    continue
                
                if char == '\\':
                    escape_next = True
                    continue
                
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                
                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            # Found the matching closing brace
                            content = content[first_brace:i + 1]
                            break
        
        # Remove any trailing commas before closing braces/brackets (common JSON error)
        content = re.sub(r',(\s*[}\]])', r'\1', content)
        
        # Fix invalid escape sequences - this is critical for AI-generated JSON
        # Step 1: Protect valid escape sequences by temporarily replacing them
        protected_escapes = {}
        escape_counter = 0
        
        def protect_valid_escape(match):
            nonlocal escape_counter
            placeholder = f"__ESCAPE_{escape_counter}__"
            protected_escapes[placeholder] = match.group(0)
            escape_counter += 1
            return placeholder
        
        # Protect valid JSON escape sequences
        content = re.sub(r'\\["\\/bfnrt]', protect_valid_escape, content)
        content = re.sub(r'\\u[0-9a-fA-F]{4}', protect_valid_escape, content)
        
        # Step 2: Remove all remaining backslashes (they're invalid)
        content = content.replace('\\', '')
        
        # Step 3: Restore protected valid escapes
        for placeholder, original in protected_escapes.items():
            content = content.replace(placeholder, original)
        
        # Fix common AI mistakes - remove placeholder text like "...omitted for brevity..."
        content = re.sub(r'\[\.\.\.omitted for brevity\.\.\.\]', '[]', content)
        content = re.sub(r'\[\.\.\..*?\.\.\.\]', '[]', content)
        content = re.sub(r'\.\.\.omitted.*?\.\.\.', '', content)
        content = re.sub(r'\.\.\.', '', content)
        
        # Fix unquoted property names (JavaScript-style to JSON)
        # Pattern: ,timing: "value" should be ,"timing": "value"
        # Pattern: {timing: "value" should be {"timing": "value"
        content = re.sub(r'([,{]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', content)
        
        # Fix missing commas between string values and keys (the main issue)
        # Pattern: "value""key" should be "value","key"
        content = re.sub(r'"\s*"([a-zA-Z_][a-zA-Z0-9_]*)"', r'","\\1"', content)
        
        # Fix missing commas between closing brace/bracket and opening quote
        # Pattern: }"key" should be },"key"  or ]"key" should be ],"key"
        content = re.sub(r'([}\]])\s*"', r'\1,"', content)
        
        # Fix missing commas between number and opening quote
        # Pattern: 123"key" should be 123,"key"
        content = re.sub(r'(\d)\s*"([a-zA-Z_])', r'\1,"\2', content)
        
        # Fix missing commas between closing quote and opening quote (array elements)
        # Pattern: "value" "value" should be "value", "value"
        # This needs to be more aggressive to catch all cases
        content = re.sub(r'"\s+(?=")', r'", ', content)
        
        # Fix missing commas between ] and "
        # Pattern: ] "text" should be ], "text"
        content = re.sub(r'\]\s*"', r'], "', content)
        
        # Fix missing commas between } and "
        # Pattern: } "text" should be }, "text"
        content = re.sub(r'\}\s*"', r'}, "', content)
        
        # Fix missing commas at end of strings before closing brackets
        # Pattern: "text"] should be "text"]  (this is actually valid, but check for "text" ] with space)
        # More importantly: "text1" "text2"] should be "text1", "text2"]
        # The above pattern should catch this, but let's be more explicit
        content = re.sub(r'"\s+\]', r'"]', content)  # Remove spaces before ]
        content = re.sub(r'"\s+\}', r'"}', content)  # Remove spaces before }
        
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {e}")
            
            # Log the problematic area around the error position
            error_pos = e.pos if hasattr(e, 'pos') else 0
            start_pos = max(0, error_pos - 150)
            end_pos = min(len(content), error_pos + 150)
            logger.error(f"Content around error position {error_pos}:")
            logger.error(f"...{content[start_pos:end_pos]}...")
            logger.error(f"Full content length: {len(content)} chars")
            logger.error(f"Original content length: {len(original_content)} chars")
            
            # Try more aggressive cleanup
            try:
                # Save the problematic content to a file for debugging
                import os
                debug_dir = "debug_json_errors"
                os.makedirs(debug_dir, exist_ok=True)
                debug_file = os.path.join(debug_dir, f"error_{error_pos}_{int(time.time())}.json")
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                logger.error(f"Saved problematic JSON to {debug_file}")
                
                # Try json5 parser which is more lenient
                try:
                    import json5
                    logger.info("Attempting to parse with json5...")
                    return json5.loads(content)
                except ImportError:
                    logger.warning("json5 not available, trying manual repair")
                except Exception as json5_error:
                    logger.warning(f"json5 parsing also failed: {json5_error}")
                
                # Last resort: try to manually fix the JSON
                logger.warning("Attempting manual JSON repair...")
                
                # Try to fix by removing problematic characters around error position
                if error_pos > 0 and error_pos < len(content):
                    # Check if it's a quote issue
                    problem_area = content[max(0, error_pos-50):min(len(content), error_pos+50)]
                    logger.error(f"Problem area: {problem_area}")
                    
                    # Try to fix the specific area around the error
                    # Look for patterns like: "text""key" and fix to "text","key"
                    fixed_content = content[:error_pos] + ',' + content[error_pos:]
                    try:
                        logger.info("Attempting to add comma at error position...")
                        return json.loads(fixed_content)
                    except:
                        pass
                
                # If all else fails, return a minimal valid structure
                raise Exception(f"Failed to parse AI response as JSON: {str(e)}. Error at position {error_pos}. The AI may have generated malformed JSON. Check logs for details.")
                
            except Exception as e3:
                logger.error(f"All JSON parsing attempts failed: {str(e3)}")
                raise Exception(f"Failed to parse AI response as JSON: {str(e)}. Error at position {error_pos}. Check logs for details.")
    
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
        difficulty: str = "intermediate",
        use_custom_condition: bool = False,
        custom_condition: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create an OSCE examination scenario"""
        from services.model_router import get_model_router_service
        
        router = get_model_router_service(self.supabase)
        
        prompt = self._build_osce_generation_prompt(scenario_type, specialty, difficulty, use_custom_condition, custom_condition)
        
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
    
    def _build_osce_generation_prompt(self, scenario_type: str, specialty: str, difficulty: str, use_custom_condition: bool = False, custom_condition: Optional[str] = None) -> str:
        """Build prompt for OSCE scenario generation based on parameters"""
        
        # Define scenario-specific guidance
        scenario_guidance = {
            "history_taking": "Focus on systematic history taking with appropriate questioning techniques",
            "physical_examination": "Include proper examination technique, patient positioning, and systematic approach",
            "communication_skills": "Emphasize breaking bad news, counseling, or explaining procedures",
            "clinical_procedure": "Detail procedural steps, safety checks, and patient communication",
            "data_interpretation": "Present investigation results requiring analysis and management planning",
            "emergency_management": "Create acute scenario requiring rapid assessment and intervention"
        }
        
        # Expanded specialty-specific conditions with more variety
        specialty_conditions = {
            "general_medicine": [
                "acute asthma exacerbation", "COPD exacerbation", "pneumonia", "pulmonary embolism",
                "acute kidney injury", "urinary tract infection", "pyelonephritis",
                "diabetic ketoacidosis", "hypoglycemia", "thyroid storm",
                "acute gastroenteritis", "inflammatory bowel disease flare", "peptic ulcer disease",
                "migraine", "seizure", "transient ischemic attack", "vertigo",
                "cellulitis", "sepsis", "infective endocarditis",
                "anemia", "deep vein thrombosis", "atrial fibrillation"
            ],
            "surgery": [
                "acute appendicitis", "acute cholecystitis", "bowel obstruction", "perforated peptic ulcer",
                "inguinal hernia", "incarcerated hernia", "testicular torsion",
                "acute pancreatitis", "diverticulitis", "rectal bleeding",
                "trauma assessment", "head injury", "fracture management",
                "wound infection", "abscess", "post-operative complications"
            ],
            "pediatrics": [
                "bronchiolitis", "croup", "asthma exacerbation", "pneumonia",
                "febrile seizure", "meningitis", "encephalitis",
                "gastroenteritis", "intussusception", "pyloric stenosis",
                "kawasaki disease", "henoch-schonlein purpura", "nephrotic syndrome",
                "developmental delay", "failure to thrive", "child safeguarding concerns"
            ],
            "obs_gynecology": [
                "ectopic pregnancy", "miscarriage", "hyperemesis gravidarum",
                "preeclampsia", "gestational diabetes", "placental abruption",
                "postpartum hemorrhage", "mastitis", "postnatal depression",
                "ovarian torsion", "pelvic inflammatory disease", "endometriosis",
                "menorrhagia", "dysmenorrhea", "contraception counseling"
            ],
            "psychiatry": [
                "major depressive disorder", "bipolar disorder", "generalized anxiety disorder",
                "panic disorder", "obsessive-compulsive disorder", "PTSD",
                "schizophrenia", "psychosis", "delirium",
                "alcohol withdrawal", "substance use disorder", "eating disorder",
                "suicide risk assessment", "capacity assessment", "self-harm"
            ],
            "emergency": [
                "anaphylaxis", "septic shock", "cardiogenic shock", "hypovolemic shock",
                "status epilepticus", "acute stroke", "subarachnoid hemorrhage",
                "major trauma", "burns", "drowning",
                "acute coronary syndrome", "aortic dissection", "cardiac arrest",
                "acute abdomen", "GI bleeding", "acute limb ischemia"
            ]
        }
        
        # Define difficulty-specific complexity
        difficulty_guidance = {
            "beginner": "Straightforward presentation with clear history. Patient cooperative and forthcoming. Classic textbook presentation.",
            "intermediate": "Moderate complexity with some ambiguity. Patient may need gentle probing. Some atypical features present.",
            "advanced": "Complex presentation with multiple factors. Patient may be anxious or have communication barriers. Requires systematic approach."
        }
        
        conditions = specialty_conditions.get(specialty, specialty_conditions["general_medicine"])
        guidance = scenario_guidance.get(scenario_type, "Create a realistic clinical scenario")
        complexity = difficulty_guidance.get(difficulty, difficulty_guidance["intermediate"])
        
        # Handle custom condition or random selection
        if use_custom_condition and custom_condition:
            suggested_condition = custom_condition
            condition_instruction = f"- You MUST create a scenario for this SPECIFIC condition: {custom_condition}"
        else:
            # Add explicit instruction to pick randomly
            import random
            suggested_condition = random.choice(conditions)
            condition_instruction = f"""- You MUST choose ONE condition from this list: {', '.join(conditions)}
- SUGGESTED condition for THIS scenario: {suggested_condition}
- DO NOT default to chest pain or common conditions - use the full variety
- Vary the presentation each time"""
        
        return f"""Generate a UNIQUE OSCE scenario for {scenario_type} in {specialty} at {difficulty} level.

CRITICAL REQUIREMENTS:
- Scenario type: {scenario_type}
- Specialty: {specialty}
- Difficulty: {difficulty}
- {guidance}
- {complexity}

CONDITION SELECTION:
{condition_instruction}

PATIENT VARIATION:
- Create DIFFERENT patient demographics each time
- Vary age (pediatric, young adult, middle-aged, elderly)
- Vary gender (male, female, non-binary where appropriate)
- Vary occupation and social circumstances
- Vary ethnic backgrounds and cultural considerations
- Make each scenario feel unique and realistic

Generate JSON with this EXACT structure:
{{
  "candidate_instructions": "Clear instructions for the candidate (what to do, time limit)",
  "time_limit": 480,
  "patient_info": {{
    "name": "Generate realistic, culturally diverse name",
    "age": "Appropriate age for condition (vary widely)",
    "gender": "male/female/other",
    "presenting_complaint": "Chief complaint specific to chosen condition",
    "appearance": "How patient appears",
    "emotional_state": "anxious/calm/distressed/cooperative/withdrawn",
    "severity": "mild/moderate/severe"
  }},
  "patient_script": {{
    "opening": "Brief initial greeting or single chief complaint only (e.g., 'Hello doctor, I've been having chest pain' - DO NOT reveal full history)",
    "responses": {{
      "relevant_question_1": "Natural response to expected question",
      "relevant_question_2": "Natural response to expected question",
      "relevant_question_3": "Natural response to expected question",
      "relevant_question_4": "Natural response to expected question"
    }}
  }},
  "checklist": [
    {{"item": "Specific action to assess", "points": 1, "category": "communication/history/examination/management", "critical": false}},
    {{"item": "Another specific action", "points": 2, "category": "history", "critical": true}},
    {{"item": "Third specific action", "points": 2, "category": "examination", "critical": true}},
    {{"item": "Fourth specific action", "points": 1, "category": "management", "critical": false}},
    {{"item": "Fifth specific action", "points": 2, "category": "communication", "critical": false}}
  ],
  "expected_actions": ["Action 1", "Action 2", "Action 3", "Action 4"]
}}

IMPORTANT:
- Generate COMPLETELY NEW patient details each time
- DO NOT repeat the same conditions frequently
- Use the FULL range of conditions provided
- Checklist should have 5-8 items specific to this scenario
- Mark 2-3 items as critical
- Make patient responses realistic and contextual
- Vary complexity based on difficulty level
- Make it educationally valuable and clinically realistic
- CRITICAL: Patient opening statement should be BRIEF (1-2 sentences max) - just a greeting and chief complaint
- Patient should NOT reveal full history, symptoms, or details in opening - these come out through questioning
- Example good opening: "Hello doctor, I've been having some chest discomfort"
- Example BAD opening: "Hello doctor, I've been having chest pain for 3 days that radiates to my left arm, with shortness of breath and nausea"

Output ONLY valid JSON, no explanations.

CRITICAL JSON RULES:
- Use only valid escape sequences: \\", \\\\, \\/, \\b, \\f, \\n, \\r, \\t
- DO NOT use invalid escapes like \\1, \\2, etc.
- If you need to include a backslash, use \\\\
- All strings must be properly quoted
- No trailing commas
- No comments"""
    
    def _sanitize_osce_for_user(self, scenario: Dict[str, Any]) -> Dict[str, Any]:
        """Remove examiner-only fields from scenario"""
        sanitized = dict(scenario)
        # Remove examiner-only fields that should not be visible to students
        sanitized.pop("examiner_checklist", None)
        sanitized.pop("expected_actions", None)
        # Also clean from patient_script if it contains examiner notes
        if "patient_script" in sanitized and isinstance(sanitized["patient_script"], dict):
            patient_script = sanitized["patient_script"]
            patient_script.pop("examiner_notes", None)
            patient_script.pop("scoring_guide", None)
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
        
        # Get the examiner checklist to help the model identify triggered items
        examiner_checklist = scenario.get("examiner_checklist", [])
        checklist_items_list = [item.get("item", "") for item in examiner_checklist if item.get("item")]
        
        prompt = f"""You are simulating an OSCE patient. Respond naturally as the patient would.

SCENARIO: {scenario.get('scenario_type')}
PATIENT INFO: {json.dumps(scenario.get('patient_info', {}))}
PATIENT SCRIPT: {json.dumps(scenario.get('patient_script', {}))}

EXAMINER CHECKLIST (items the student should complete):
{json.dumps(checklist_items_list, indent=2)}

RECENT INTERACTIONS:
{json.dumps(interaction_history[-5:], indent=2) if interaction_history else "None yet"}

STUDENT'S ACTION:
{user_action}

INSTRUCTIONS:
1. Respond ONLY with valid JSON - no comments or extra text
2. patient_response: What the patient says naturally in response to THIS specific action only
3. checklist_triggered: Array of EXACT item names from the checklist above that THIS action satisfies
4. examiner_notes: Brief note about what the student did (for internal tracking)
5. next_step_hint: Optional subtle hint if student seems stuck (keep it realistic)

IMPORTANT: 
- Patient should respond ONLY to the current question/action, not reveal everything at once
- Use EXACT item names from checklist (copy-paste them)
- Only mark items as triggered if the student's action clearly satisfies them
- Keep patient responses natural and conversational

JSON format:
{{
  "patient_response": "Natural response to the current action only",
  "examiner_notes": "What the student did in this interaction",
  "checklist_triggered": ["Exact item name from checklist"],
  "next_step_hint": null
}}

Example: If student says "Hello, I'm Dr. Smith", patient might say "Hello Doctor" and checklist_triggered would include "Introduces self and confirms patient identity" if that exact phrase is in the checklist."""

        provider = await router.select_provider("osce")
        result = await router.execute_with_fallback(
            provider=provider,
            feature="osce",
            prompt=prompt,
            system_prompt="You are simulating an OSCE examination. Respond as a realistic patient. Output ONLY valid JSON with no comments or extra text."
        )
        
        if not result["success"]:
            return {"patient_response": "I'm not sure what you mean, doctor.", "error": True}
        
        try:
            interaction_data = self._parse_json_response(result["content"])
        except Exception as parse_error:
            logger.warning(f"Failed to parse JSON response: {parse_error}. Attempting to extract fields from raw content.")
            # Try to extract fields from the malformed JSON
            import re
            raw_content = result.get("content", "")
            
            # Initialize with defaults
            interaction_data = {
                "patient_response": "I'm not sure how to respond to that. Could you rephrase your question?",
                "checklist_triggered": [],
                "examiner_notes": "",
                "feedback_if_needed": None,
                "next_step_hint": None
            }
            
            # Try to find "patient_response": "..." pattern
            match = re.search(r'"patient_response"\s*:\s*"([^"]*(?:\\.[^"]*)*)"', raw_content, re.DOTALL)
            if match:
                patient_text = match.group(1)
                # Unescape JSON string escapes
                patient_text = patient_text.replace('\\"', '"').replace('\\n', '\n').replace('\\t', '\t')
                interaction_data["patient_response"] = patient_text
                logger.info(f"Successfully extracted patient_response from malformed JSON")
            
            # Try to find "checklist_triggered": [...] pattern
            match = re.search(r'"checklist_triggered"\s*:\s*\[(.*?)\]', raw_content, re.DOTALL)
            if match:
                items_str = match.group(1)
                # Extract quoted strings from the array
                items = re.findall(r'"([^"]*)"', items_str)
                interaction_data["checklist_triggered"] = items
                logger.info(f"Successfully extracted {len(items)} checklist items from malformed JSON")
            
            # Try to find "examiner_notes": "..." pattern
            match = re.search(r'"examiner_notes"\s*:\s*"([^"]*(?:\\.[^"]*)*)"', raw_content, re.DOTALL)
            if match:
                notes = match.group(1)
                notes = notes.replace('\\"', '"').replace('\\n', '\n').replace('\\t', '\t')
                interaction_data["examiner_notes"] = notes
                logger.info(f"Successfully extracted examiner_notes from malformed JSON")
        
        # Ensure interaction_data is a dict
        if not isinstance(interaction_data, dict):
            logger.error(f"interaction_data is not a dict, it's a {type(interaction_data)}. Converting to dict.")
            interaction_data = {
                "patient_response": "I'm not sure how to respond to that. Could you rephrase your question?",
                "checklist_triggered": [],
                "examiner_notes": "",
                "feedback_if_needed": None,
                "next_step_hint": None
            }
        
        # Clean the patient response - remove any JSON artifacts or examiner notes
        patient_response = interaction_data.get("patient_response", "")
        
        # If the response contains JSON-like structures, extract just the text
        if isinstance(patient_response, dict):
            # If it's a dict, try to get the actual response text
            patient_response = patient_response.get("text", str(patient_response))
        
        # Remove any examiner notes or metadata that might have leaked into the response
        if "examiner_notes" in str(patient_response).lower() or "checklist" in str(patient_response).lower():
            # Try to extract just the patient dialogue
            import re
            # Look for quoted speech or clean text before metadata
            match = re.search(r'^([^{]*?)(?:\{|examiner_notes|checklist)', patient_response, re.IGNORECASE)
            if match:
                patient_response = match.group(1).strip()
        
        # Update interaction history (store full data internally)
        checklist_items = []
        examiner_notes = ""
        if isinstance(interaction_data, dict):
            checklist_items = interaction_data.get("checklist_triggered", [])
            examiner_notes = interaction_data.get("examiner_notes", "")
            logger.info(f"Checklist items triggered in this interaction: {checklist_items}")
        
        interaction_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "student": user_action,
            "patient": patient_response,
            "checklist_items": checklist_items,
            "examiner_notes": examiner_notes  # Store but don't return
        })
        
        self.supabase.table("osce_scenarios")\
            .update({"interaction_history": interaction_history})\
            .eq("id", scenario_id)\
            .execute()
        
        # Return only patient-facing information
        feedback_value = None
        next_hint = None
        if isinstance(interaction_data, dict):
            feedback_value = interaction_data.get("feedback_if_needed")
            next_hint = interaction_data.get("next_step_hint")
        
        response_data = {
            "patient_response": patient_response
        }
        
        # Only include feedback/hint if they exist
        if feedback_value:
            response_data["feedback"] = feedback_value
        if next_hint:
            response_data["hint"] = next_hint
            
        return response_data
    
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
