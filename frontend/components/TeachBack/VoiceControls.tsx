/**
 * Voice Controls Component
 * 
 * Handles voice recording for voice input mode.
 * Note: Requires HTTPS for microphone access.
 */

import { useState, useRef } from 'react';
import styles from '../../styles/TeachBack.module.css';

interface VoiceControlsProps {
  onSendMessage: (message: string, audioData?: Blob) => void;
  disabled: boolean;
}

export default function VoiceControls({ onSendMessage, disabled }: VoiceControlsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError(null);

      // Check if running on HTTPS (required for microphone access)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setError('Voice recording requires HTTPS. Please use a secure connection.');
        return;
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000  // Whisper prefers 16kHz
        } 
      });

      // Create MediaRecorder with appropriate format
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Send audio to backend for transcription
        onSendMessage('', audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Failed to access microphone. Please check permissions.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className={styles.voiceControls}>
      {error && (
        <div className={styles.voiceError}>
          {error}
        </div>
      )}

      <div className={styles.voiceButton}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={disabled}
            className={styles.recordButton}
          >
            🎤 Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className={styles.stopButton}
          >
            ⏹️ Stop Recording
          </button>
        )}
      </div>

      {isRecording && (
        <div className={styles.recordingIndicator}>
          <span className={styles.recordingDot}></span>
          Recording...
        </div>
      )}

      <div className={styles.voiceNote}>
        <strong>Note:</strong> Voice recording requires microphone permissions and HTTPS.
        Audio will be transcribed by Whisper STT.
      </div>
    </div>
  );
}
