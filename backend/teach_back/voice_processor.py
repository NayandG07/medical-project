"""
Voice processing for teach-back sessions.

Handles speech-to-text (STT) and text-to-speech (TTS) with graceful degradation.
"""

import os
import logging
from typing import Optional
from pathlib import Path

from .models import TranscriptionResult, AudioResult

logger = logging.getLogger(__name__)


class VoiceProcessor:
    """
    Handles voice input/output processing with STT and TTS engines.
    
    Uses:
    - Whisper-large-v3 for speech-to-text
    - Piper TTS for text-to-speech
    
    Models are loaded from configurable directory (LOCAL_MODELS_DIR).
    """
    
    def __init__(self, models_dir: Optional[str] = None):
        """
        Initialize voice processor with model paths.
        
        Args:
            models_dir: Base directory for models (default: /local_models from env)
        """
        # Get models directory from environment or use default
        self.models_dir = models_dir or os.getenv("LOCAL_MODELS_DIR", "/local_models")
        
        # Construct model paths relative to models_dir
        self.stt_model_path = os.path.join(self.models_dir, "stt", "whisper-large-v3")
        self.tts_model_path = os.path.join(self.models_dir, "tts", "piper")
        
        # Lazy loading - models loaded on first use
        self._stt_model = None
        self._tts_model = None
        self._stt_available = None
        self._tts_available = None
        
        logger.info(f"VoiceProcessor initialized with models_dir: {self.models_dir}")
        logger.info(f"STT model path: {self.stt_model_path}")
        logger.info(f"TTS model path: {self.tts_model_path}")
    
    def _load_stt_model(self):
        """Load Whisper STT model lazily."""
        if self._stt_model is not None:
            return
        
        try:
            import whisper
            
            # Check if model exists
            if not os.path.exists(self.stt_model_path):
                logger.error(f"STT model not found at {self.stt_model_path}")
                self._stt_available = False
                return
            
            logger.info("Loading Whisper STT model...")
            self._stt_model = whisper.load_model("large-v3", download_root=os.path.dirname(self.stt_model_path))
            self._stt_available = True
            logger.info("Whisper STT model loaded successfully")
            
        except ImportError:
            logger.error("whisper library not installed. Install with: pip install openai-whisper")
            self._stt_available = False
        except Exception as e:
            logger.error(f"Error loading STT model: {str(e)}")
            self._stt_available = False
    
    def _load_tts_model(self):
        """Load Piper TTS model lazily."""
        if self._tts_model is not None:
            return
        
        try:
            # Check if Piper binary exists
            piper_binary = os.path.join(self.tts_model_path, "piper")
            if not os.path.exists(piper_binary):
                logger.error(f"Piper TTS binary not found at {piper_binary}")
                self._tts_available = False
                return
            
            # Check if voice model exists
            voice_model = os.path.join(self.tts_model_path, "en_US-lessac-medium.onnx")
            if not os.path.exists(voice_model):
                logger.error(f"TTS voice model not found at {voice_model}")
                self._tts_available = False
                return
            
            logger.info("Piper TTS model paths verified")
            self._tts_model = {
                "binary": piper_binary,
                "voice_model": voice_model
            }
            self._tts_available = True
            logger.info("Piper TTS model loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading TTS model: {str(e)}")
            self._tts_available = False
    
    def is_stt_available(self) -> bool:
        """
        Check if STT engine is available.
        
        Returns:
            True if STT is available
        """
        if self._stt_available is None:
            self._load_stt_model()
        return self._stt_available or False
    
    def is_tts_available(self) -> bool:
        """
        Check if TTS engine is available.
        
        Returns:
            True if TTS is available
        """
        if self._tts_available is None:
            self._load_tts_model()
        return self._tts_available or False
    
    async def transcribe_audio(
        self,
        audio_data: bytes,
        language: str = "en"
    ) -> TranscriptionResult:
        """
        Transcribe audio to text using Whisper STT.
        
        Args:
            audio_data: Audio bytes (WAV or MP3 format)
            language: Language code (default: "en")
            
        Returns:
            TranscriptionResult with text or error
        """
        try:
            # Check if STT is available
            if not self.is_stt_available():
                return TranscriptionResult(
                    success=False,
                    text=None,
                    error_code="STT_UNAVAILABLE",
                    error_message="Speech-to-text engine is not available. Please use text input."
                )
            
            # Load model if not already loaded
            if self._stt_model is None:
                self._load_stt_model()
            
            if self._stt_model is None:
                return TranscriptionResult(
                    success=False,
                    text=None,
                    error_code="STT_FAILED",
                    error_message="Failed to load STT model"
                )
            
            # Save audio to temporary file
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
                temp_audio.write(audio_data)
                temp_audio_path = temp_audio.name
            
            try:
                # Transcribe audio
                result = self._stt_model.transcribe(
                    temp_audio_path,
                    language=language,
                    fp16=False  # Use FP32 for better compatibility
                )
                
                text = result["text"].strip()
                
                # Check if transcription is empty or too short (poor quality)
                if not text or len(text) < 3:
                    return TranscriptionResult(
                        success=False,
                        text=None,
                        error_code="AUDIO_QUALITY_POOR",
                        error_message="Audio quality too poor to transcribe. Please try again."
                    )
                
                return TranscriptionResult(
                    success=True,
                    text=text,
                    error_code=None,
                    error_message=None
                )
                
            finally:
                # Clean up temporary file
                os.unlink(temp_audio_path)
                
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            return TranscriptionResult(
                success=False,
                text=None,
                error_code="STT_FAILED",
                error_message=f"Transcription failed: {str(e)}"
            )
    
    async def synthesize_speech(
        self,
        text: str,
        voice: str = "default"
    ) -> AudioResult:
        """
        Synthesize speech from text using Piper TTS.
        
        Args:
            text: Text to synthesize
            voice: Voice model to use (default: "default")
            
        Returns:
            AudioResult with audio bytes or error
        """
        try:
            # Check if TTS is available
            if not self.is_tts_available():
                return AudioResult(
                    success=False,
                    audio_data=None,
                    error_code="TTS_UNAVAILABLE",
                    error_message="Text-to-speech engine is not available. Displaying text only."
                )
            
            # Load model if not already loaded
            if self._tts_model is None:
                self._load_tts_model()
            
            if self._tts_model is None:
                return AudioResult(
                    success=False,
                    audio_data=None,
                    error_code="TTS_FAILED",
                    error_message="Failed to load TTS model"
                )
            
            # Use Piper to synthesize speech
            import subprocess
            import tempfile
            
            # Create temporary output file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_output:
                temp_output_path = temp_output.name
            
            try:
                # Run Piper TTS
                process = subprocess.run(
                    [
                        self._tts_model["binary"],
                        "--model", self._tts_model["voice_model"],
                        "--output_file", temp_output_path
                    ],
                    input=text.encode("utf-8"),
                    capture_output=True,
                    timeout=30  # 30 second timeout
                )
                
                if process.returncode != 0:
                    error_msg = process.stderr.decode("utf-8") if process.stderr else "Unknown error"
                    logger.error(f"Piper TTS failed: {error_msg}")
                    return AudioResult(
                        success=False,
                        audio_data=None,
                        error_code="TTS_FAILED",
                        error_message=f"Speech synthesis failed: {error_msg}"
                    )
                
                # Read generated audio
                with open(temp_output_path, "rb") as audio_file:
                    audio_data = audio_file.read()
                
                return AudioResult(
                    success=True,
                    audio_data=audio_data,
                    error_code=None,
                    error_message=None
                )
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_output_path):
                    os.unlink(temp_output_path)
                
        except subprocess.TimeoutExpired:
            logger.error("TTS synthesis timed out")
            return AudioResult(
                success=False,
                audio_data=None,
                error_code="TTS_FAILED",
                error_message="Speech synthesis timed out"
            )
        except Exception as e:
            logger.error(f"Error synthesizing speech: {str(e)}")
            return AudioResult(
                success=False,
                audio_data=None,
                error_code="TTS_FAILED",
                error_message=f"Speech synthesis failed: {str(e)}"
            )
