"""
Medical Image Service
Handles medical image classification, analysis, and storage
Separate from RAG document system
"""
import os
import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
from supabase import Client
import logging
import io
from PIL import Image

logger = logging.getLogger(__name__)


class MedicalImageService:
    """Service for medical image analysis and classification"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.storage_bucket = "medical-images"
        self.vision_provider = None
        self._init_vision_provider()
    
    def _init_vision_provider(self):
        """Initialize vision model provider"""
        try:
            from services.providers.huggingface import get_huggingface_provider
            self.vision_provider = get_huggingface_provider()
            if self.vision_provider:
                logger.info("Vision provider initialized for medical image analysis")
            else:
                logger.warning("Vision provider not available")
        except Exception as e:
            logger.error(f"Failed to initialize vision provider: {str(e)}")
            self.vision_provider = None
    
    async def upload_medical_image(
        self,
        user_id: str,
        file_content: bytes,
        filename: str,
        file_type: str,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Upload a medical image for analysis
        
        Args:
            user_id: User ID
            file_content: Image bytes
            filename: Original filename
            file_type: MIME type
            category: Optional category (xray, ct, mri, pathology, etc.)
        
        Returns:
            Medical image metadata
        """
        try:
            # Validate image
            try:
                image = Image.open(io.BytesIO(file_content))
                width, height = image.size
                image_format = image.format
            except Exception as e:
                raise Exception(f"Invalid image file: {str(e)}")
            
            # Generate unique storage path
            file_extension = filename.split('.')[-1] if '.' in filename else 'jpg'
            storage_filename = f"{user_id}/{uuid.uuid4()}.{file_extension}"
            
            # Calculate file size and hash
            file_size = len(file_content)
            file_hash = hashlib.sha256(file_content).hexdigest()
            
            # Upload to Supabase Storage
            try:
                self.supabase.storage.from_(self.storage_bucket).upload(
                    storage_filename,
                    file_content,
                    {"content-type": file_type}
                )
            except Exception as storage_error:
                logger.error(f"Storage upload failed: {str(storage_error)}")
                # If bucket doesn't exist, create it
                try:
                    self.supabase.storage.create_bucket(self.storage_bucket, {"public": False})
                    self.supabase.storage.from_(self.storage_bucket).upload(
                        storage_filename,
                        file_content,
                        {"content-type": file_type}
                    )
                except Exception as e:
                    raise Exception(f"Failed to upload to storage: {str(e)}")
            
            # Create medical image record
            image_data = {
                "user_id": user_id,
                "filename": filename,
                "file_type": file_type,
                "file_size": file_size,
                "storage_path": storage_filename,
                "width": width,
                "height": height,
                "format": image_format,
                "category": category,
                "analysis_status": "pending",
                "created_at": datetime.now().isoformat()
            }
            
            result = self.supabase.table("medical_images").insert(image_data).execute()
            
            if not result.data:
                raise Exception("Failed to create medical image record")
            
            medical_image = result.data[0]
            
            # Start async analysis
            await self._analyze_image_async(medical_image["id"], file_content)
            
            return medical_image
            
        except Exception as e:
            logger.error(f"Medical image upload failed: {str(e)}")
            raise
    
    async def _analyze_image_async(self, image_id: str, file_content: bytes):
        """
        Analyze medical image using vision model
        """
        try:
            # Update status to analyzing
            self.supabase.table("medical_images").update({
                "analysis_status": "analyzing"
            }).eq("id", image_id).execute()
            
            if not self.vision_provider:
                raise Exception("Vision provider not available")
            
            # Prepare image for vision model
            import base64
            image_base64 = base64.b64encode(file_content).decode('utf-8')
            
            # Call vision model for analysis
            prompt = """Analyze this medical image and provide:
1. Image Type: (X-ray, CT, MRI, Ultrasound, Pathology slide, etc.)
2. Body Part/Region: (Chest, Abdomen, Brain, etc.)
3. Key Findings: List any notable findings or abnormalities
4. Clinical Impression: Brief clinical assessment
5. Recommendations: Any follow-up or additional imaging needed

Provide a structured medical analysis."""
            
            # Use HuggingFace vision model
            result = await self.vision_provider.call_huggingface(
                feature="image",
                prompt=prompt,
                system_prompt="You are an expert radiologist and medical imaging specialist. Provide detailed, accurate medical image analysis.",
                max_tokens=2048,
                temperature=0.3
            )
            
            if result["success"]:
                analysis_text = result["content"]
                
                # Parse analysis to extract structured data
                structured_analysis = self._parse_analysis(analysis_text)
                
                # Update medical image with analysis
                self.supabase.table("medical_images").update({
                    "analysis_status": "completed",
                    "analysis_text": analysis_text,
                    "image_type": structured_analysis.get("image_type"),
                    "body_region": structured_analysis.get("body_region"),
                    "findings": structured_analysis.get("findings"),
                    "clinical_impression": structured_analysis.get("clinical_impression"),
                    "analyzed_at": datetime.now().isoformat()
                }).eq("id", image_id).execute()
                
                logger.info(f"Medical image {image_id} analyzed successfully")
            else:
                raise Exception(f"Vision model failed: {result.get('error')}")
            
        except Exception as e:
            logger.error(f"Medical image analysis failed: {str(e)}")
            self.supabase.table("medical_images").update({
                "analysis_status": "failed",
                "error_message": str(e)
            }).eq("id", image_id).execute()
    
    def _parse_analysis(self, analysis_text: str) -> Dict[str, Any]:
        """Parse structured data from analysis text"""
        try:
            structured = {
                "image_type": None,
                "body_region": None,
                "findings": [],
                "clinical_impression": None
            }
            
            lines = analysis_text.split('\n')
            current_section = None
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Detect sections
                if "image type:" in line.lower():
                    current_section = "image_type"
                    structured["image_type"] = line.split(':', 1)[1].strip()
                elif "body part" in line.lower() or "region:" in line.lower():
                    current_section = "body_region"
                    structured["body_region"] = line.split(':', 1)[1].strip()
                elif "key findings:" in line.lower() or "findings:" in line.lower():
                    current_section = "findings"
                elif "clinical impression:" in line.lower() or "impression:" in line.lower():
                    current_section = "clinical_impression"
                    structured["clinical_impression"] = line.split(':', 1)[1].strip() if ':' in line else ""
                elif current_section == "findings" and (line.startswith('-') or line.startswith('•') or line[0].isdigit()):
                    structured["findings"].append(line.lstrip('-•0123456789. '))
                elif current_section == "clinical_impression" and not line.startswith(('1.', '2.', '3.', '4.', '5.')):
                    if structured["clinical_impression"]:
                        structured["clinical_impression"] += " " + line
                    else:
                        structured["clinical_impression"] = line
            
            return structured
            
        except Exception as e:
            logger.warning(f"Failed to parse analysis: {str(e)}")
            return {}
    
    async def get_user_medical_images(
        self,
        user_id: str,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get user's medical images"""
        try:
            query = self.supabase.table("medical_images").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit)
            
            if category:
                query = query.eq("category", category)
            
            result = query.execute()
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get medical images: {str(e)}")
            return []
    
    async def get_medical_image(self, user_id: str, image_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific medical image"""
        try:
            result = self.supabase.table("medical_images").select("*").eq("id", image_id).eq("user_id", user_id).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get medical image: {str(e)}")
            return None
    
    async def delete_medical_image(self, user_id: str, image_id: str):
        """Delete a medical image"""
        try:
            # Get image
            image_result = self.supabase.table("medical_images").select("*").eq("id", image_id).eq("user_id", user_id).execute()
            
            if not image_result.data or len(image_result.data) == 0:
                raise Exception("Medical image not found")
            
            image = image_result.data[0]
            
            # Delete from storage
            try:
                storage_path = image.get("storage_path")
                if storage_path:
                    self.supabase.storage.from_(self.storage_bucket).remove([storage_path])
            except Exception as e:
                logger.warning(f"Failed to delete from storage: {str(e)}")
            
            # Delete record
            self.supabase.table("medical_images").delete().eq("id", image_id).execute()
            
            logger.info(f"Medical image {image_id} deleted successfully")
            
        except Exception as e:
            logger.error(f"Failed to delete medical image: {str(e)}")
            raise
    
    async def query_medical_images(
        self,
        user_id: str,
        query: str,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search medical images by text query
        Searches in analysis text, findings, and clinical impressions
        """
        try:
            # Text search in analysis fields
            result = self.supabase.table("medical_images").select("*").eq("user_id", user_id).or_(
                f"analysis_text.ilike.%{query}%,"
                f"findings.ilike.%{query}%,"
                f"clinical_impression.ilike.%{query}%,"
                f"image_type.ilike.%{query}%,"
                f"body_region.ilike.%{query}%"
            ).limit(top_k).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Medical image search failed: {str(e)}")
            return []


def get_medical_image_service(supabase: Client) -> MedicalImageService:
    """Factory function to get medical image service instance"""
    return MedicalImageService(supabase)
