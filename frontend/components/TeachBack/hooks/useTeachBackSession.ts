/**
 * Custom hook for managing teach-back session state
 */

import { useState, useEffect, useCallback } from 'react';

interface Session {
  id: string;
  topic: string;
  input_mode: string;
  output_mode: string;
  state: string;
  started_at: string;
}

interface TranscriptEntry {
  speaker: string;
  content: string;
  is_voice: boolean;
  timestamp: string;
}

interface Interruption {
  errors: Array<{
    error_text: string;
    correction: string;
    severity: string;
  }>;
  message: string;
}

interface Examination {
  question: string;
  evaluation?: string;
  score?: number;
}

interface Summary {
  total_errors: number;
  missed_concepts: string[];
  strong_areas: string[];
  recommendations: string[];
  overall_score: number;
}

interface Quota {
  text_sessions_used: number;
  voice_sessions_used: number;
  text_sessions_limit: number;
  voice_sessions_limit: number;
  date: string;
}

export function useTeachBackSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentState, setCurrentState] = useState<string>('');
  const [interruption, setInterruption] = useState<Interruption | null>(null);
  const [examination, setExamination] = useState<Examination | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Get auth token
  const getToken = () => {
    return localStorage.getItem('token');
  };

  // Fetch quota on mount
  useEffect(() => {
    fetchQuota();
  }, []);

  // Poll transcript when session is active
  useEffect(() => {
    if (session && currentState !== 'completed') {
      const interval = setInterval(() => {
        fetchTranscript();
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [session, currentState]);

  const fetchQuota = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/teach-back/quota`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setQuota(data.quota);
        }
      }
    } catch (err) {
      console.error('Failed to fetch quota:', err);
    }
  };

  const fetchTranscript = async () => {
    if (!session) return;

    try {
      const response = await fetch(`${API_BASE}/api/teach-back/sessions/${session.id}/transcript`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTranscript(data.transcript);
        }
      }
    } catch (err) {
      console.error('Failed to fetch transcript:', err);
    }
  };

  const createSession = async (inputMode: string, outputMode: string, topic: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/teach-back/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          input_mode: inputMode,
          output_mode: outputMode,
          topic: topic || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSession(data.session);
        setCurrentState(data.session.state);
        setQuota(data.remaining_quota);
        return true;
      } else {
        setError(data.error?.message || 'Failed to create session');
        return false;
      }
    } catch (err) {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (message: string, audioData?: Blob) => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      let response;
      
      if (audioData) {
        // Send audio for transcription
        const formData = new FormData();
        formData.append('audio', audioData, 'recording.webm');

        response = await fetch(`${API_BASE}/api/teach-back/sessions/${session.id}/input`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
          },
          body: formData,
        });
      } else {
        // Send text message
        response = await fetch(`${API_BASE}/api/teach-back/sessions/${session.id}/input`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ content: message }),
        });
      }

      const data = await response.json();

      if (data.success) {
        setCurrentState(data.response.state);
        
        // Check for interruption
        if (data.response.interrupted) {
          setInterruption({
            errors: data.response.errors || [],
            message: data.response.content,
          });
        }

        // Play audio if available (voice output mode)
        if (data.response.audio && session.output_mode === 'voice_text') {
          playAudio(data.response.audio);
        }

        // Refresh transcript
        await fetchTranscript();
      } else {
        setError(data.error?.message || 'Failed to send message');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (audioBase64: string) => {
    try {
      // Convert base64 to blob
      const audioBlob = base64ToBlob(audioBase64, 'audio/wav');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create and play audio element
      const audio = new Audio(audioUrl);
      audio.play().catch(err => {
        console.error('Audio playback failed:', err);
        // Continue with text-only if audio fails
      });

      // Clean up URL after playback
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (err) {
      console.error('Failed to play audio:', err);
      // Continue with text-only if audio fails
    }
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const acknowledgeInterruption = async () => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/teach-back/sessions/${session.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setCurrentState(data.state);
        setInterruption(null);
      } else {
        setError(data.error?.message || 'Failed to acknowledge interruption');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startExamination = async () => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/teach-back/sessions/${session.id}/start-examination`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setCurrentState(data.state);
        setExamination({ question: data.question });
      } else {
        setError(data.error?.message || 'Failed to start examination');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (question: string, answer: string) => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/teach-back/sessions/${session.id}/submit-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ question, answer }),
      });

      const data = await response.json();

      if (data.success) {
        setExamination({
          question,
          evaluation: data.evaluation,
          score: data.score,
        });
      } else {
        setError(data.error?.message || 'Failed to submit answer');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/teach-back/sessions/${session.id}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setCurrentState('completed');
        setSummary(data.summary);
        await fetchQuota(); // Refresh quota
      } else {
        setError(data.error?.message || 'Failed to end session');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return {
    session,
    transcript,
    currentState,
    interruption,
    examination,
    summary,
    quota,
    loading,
    error,
    createSession,
    sendMessage,
    acknowledgeInterruption,
    startExamination,
    submitAnswer,
    endSession,
  };
}
