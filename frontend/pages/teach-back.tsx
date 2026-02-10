/**
 * Teach-Back Mode Page
 * 
 * Interactive learning assistant where users teach concepts back to the AI.
 * The AI acts as a student, asks questions, detects errors, and provides feedback.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ModeSelector from '../components/TeachBack/ModeSelector';
import LiveTranscript from '../components/TeachBack/LiveTranscript';
import InterruptionIndicator from '../components/TeachBack/InterruptionIndicator';
import SessionSummary from '../components/TeachBack/SessionSummary';
import VoiceControls from '../components/TeachBack/VoiceControls';
import ExaminationView from '../components/TeachBack/ExaminationView';
import { useTeachBackSession } from '../components/TeachBack/hooks/useTeachBackSession';
import styles from '../styles/TeachBack.module.css';

export default function TeachBackPage() {
  const router = useRouter();
  const [isStarted, setIsStarted] = useState(false);
  
  const {
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
  } = useTeachBackSession();

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleStartSession = async (inputMode: string, outputMode: string, topic: string) => {
    const success = await createSession(inputMode, outputMode, topic);
    if (success) {
      setIsStarted(true);
    }
  };

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  const handleAcknowledge = async () => {
    await acknowledgeInterruption();
  };

  const handleStartExam = async () => {
    await startExamination();
  };

  const handleSubmitAnswer = async (question: string, answer: string) => {
    await submitAnswer(question, answer);
  };

  const handleEndSession = async () => {
    await endSession();
  };

  const handleNewSession = () => {
    setIsStarted(false);
  };

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Teach-Back Mode</h1>
          <p className={styles.subtitle}>
            Teach a concept to our AI student. We'll ask questions, detect errors, and help you learn through teaching.
          </p>
          
          {quota && (
            <div className={styles.quota}>
              <span>Text Sessions: {quota.text_sessions_limit - quota.text_sessions_used}/{quota.text_sessions_limit}</span>
              <span>Voice Sessions: {quota.voice_sessions_limit - quota.voice_sessions_used}/{quota.voice_sessions_limit}</span>
            </div>
          )}
        </div>

        {error && (
          <div className={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!isStarted ? (
          <ModeSelector
            onStart={handleStartSession}
            loading={loading}
            quota={quota}
          />
        ) : (
          <div className={styles.sessionContainer}>
            {/* Interruption Indicator */}
            {interruption && (
              <InterruptionIndicator
                interruption={interruption}
                onAcknowledge={handleAcknowledge}
              />
            )}

            {/* Main Content Area */}
            <div className={styles.mainContent}>
              {/* Transcript */}
              <div className={styles.transcriptSection}>
                <LiveTranscript
                  transcript={transcript}
                  currentState={currentState}
                />
              </div>

              {/* Input Area */}
              <div className={styles.inputSection}>
                {currentState === 'examining' && examination ? (
                  <ExaminationView
                    question={examination.question}
                    onSubmit={handleSubmitAnswer}
                    loading={loading}
                  />
                ) : currentState === 'completed' && summary ? (
                  <SessionSummary
                    summary={summary}
                    onNewSession={handleNewSession}
                  />
                ) : (
                  <>
                    {session?.input_mode === 'voice' || session?.input_mode === 'mixed' ? (
                      <VoiceControls
                        onSendMessage={handleSendMessage}
                        disabled={loading || currentState === 'interrupted'}
                      />
                    ) : null}
                    
                    <div className={styles.textInput}>
                      <textarea
                        placeholder={
                          currentState === 'interrupted'
                            ? 'Please acknowledge the correction above to continue...'
                            : 'Teach your concept here...'
                        }
                        disabled={loading || currentState === 'interrupted'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const message = e.currentTarget.value.trim();
                            if (message) {
                              handleSendMessage(message);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                        className={styles.textarea}
                      />
                      <div className={styles.actions}>
                        {currentState === 'teaching' && (
                          <button
                            onClick={handleStartExam}
                            disabled={loading}
                            className={styles.examButton}
                          >
                            Start Examination
                          </button>
                        )}
                        <button
                          onClick={handleEndSession}
                          disabled={loading}
                          className={styles.endButton}
                        >
                          End Session
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Session Info */}
            <div className={styles.sessionInfo}>
              <div className={styles.infoItem}>
                <span className={styles.label}>Topic:</span>
                <span className={styles.value}>{session?.topic || 'General'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>State:</span>
                <span className={`${styles.value} ${styles[currentState]}`}>
                  {currentState}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.label}>Mode:</span>
                <span className={styles.value}>
                  {session?.input_mode} → {session?.output_mode}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
