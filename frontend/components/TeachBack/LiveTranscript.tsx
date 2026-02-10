/**
 * Live Transcript Component
 * 
 * Displays real-time transcript of the teaching session with auto-scroll.
 */

import { useEffect, useRef } from 'react';
import styles from '../../styles/TeachBack.module.css';

interface TranscriptEntry {
  speaker: string;
  content: string;
  is_voice: boolean;
  timestamp: string;
}

interface LiveTranscriptProps {
  transcript: TranscriptEntry[];
  currentState: string;
}

export default function LiveTranscript({ transcript, currentState }: LiveTranscriptProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={styles.transcript}>
      <div className={styles.transcriptHeader}>
        <h3>Transcript</h3>
        <span className={styles.stateIndicator}>
          {currentState === 'teaching' && '📝 Teaching'}
          {currentState === 'interrupted' && '⚠️ Interrupted'}
          {currentState === 'examining' && '📋 Examination'}
          {currentState === 'completed' && '✅ Completed'}
        </span>
      </div>

      <div className={styles.transcriptContent}>
        {transcript.length === 0 ? (
          <div className={styles.emptyTranscript}>
            <p>Start teaching to see the conversation here...</p>
          </div>
        ) : (
          transcript.map((entry, index) => (
            <div
              key={index}
              className={`${styles.transcriptEntry} ${
                entry.speaker === 'user' ? styles.userEntry : styles.systemEntry
              }`}
            >
              <div className={styles.entryHeader}>
                <span className={styles.speaker}>
                  {entry.speaker === 'user' ? '👤 You' : '🤖 AI Student'}
                  {entry.is_voice && ' 🎤'}
                </span>
                <span className={styles.timestamp}>
                  {formatTime(entry.timestamp)}
                </span>
              </div>
              <div className={styles.entryContent}>
                {entry.content}
              </div>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
}
