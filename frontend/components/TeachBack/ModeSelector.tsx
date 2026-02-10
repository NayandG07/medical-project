/**
 * Mode Selector Component
 * 
 * Allows users to select input/output modes and topic before starting a session.
 */

import { useState } from 'react';
import styles from '../../styles/TeachBack.module.css';

interface ModeSelectorProps {
  onStart: (inputMode: string, outputMode: string, topic: string) => void;
  loading: boolean;
  quota: {
    text_sessions_used: number;
    voice_sessions_used: number;
    text_sessions_limit: number;
    voice_sessions_limit: number;
  } | null;
}

export default function ModeSelector({ onStart, loading, quota }: ModeSelectorProps) {
  const [inputMode, setInputMode] = useState('text');
  const [outputMode, setOutputMode] = useState('text');
  const [topic, setTopic] = useState('');

  const handleStart = () => {
    if (!topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    // Check quota
    if (quota) {
      const isVoice = inputMode === 'voice' || inputMode === 'mixed' || outputMode === 'voice_text';
      if (isVoice && quota.voice_sessions_used >= quota.voice_sessions_limit) {
        alert('Voice session quota exceeded. Please upgrade your plan or use text mode.');
        return;
      }
      if (!isVoice && quota.text_sessions_used >= quota.text_sessions_limit) {
        alert('Text session quota exceeded. Please upgrade your plan.');
        return;
      }
    }

    onStart(inputMode, outputMode, topic);
  };

  return (
    <div className={styles.modeSelector}>
      <div className={styles.card}>
        <h2>Start a New Session</h2>
        
        <div className={styles.formGroup}>
          <label htmlFor="topic">Topic</label>
          <input
            id="topic"
            type="text"
            placeholder="e.g., Cardiovascular System, Diabetes Management"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={styles.input}
            disabled={loading}
          />
          <small>What concept would you like to teach?</small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="inputMode">Input Mode</label>
          <select
            id="inputMode"
            value={inputMode}
            onChange={(e) => setInputMode(e.target.value)}
            className={styles.select}
            disabled={loading}
          >
            <option value="text">Text Only</option>
            <option value="voice">Voice Only</option>
            <option value="mixed">Text + Voice Mixed</option>
          </select>
          <small>How would you like to teach?</small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="outputMode">Output Mode</label>
          <select
            id="outputMode"
            value={outputMode}
            onChange={(e) => setOutputMode(e.target.value)}
            className={styles.select}
            disabled={loading}
          >
            <option value="text">Text Only</option>
            <option value="voice_text">Voice + Text</option>
          </select>
          <small>How should the AI respond?</small>
        </div>

        {(inputMode === 'voice' || inputMode === 'mixed' || outputMode === 'voice_text') && (
          <div className={styles.voiceWarning}>
            <strong>Note:</strong> Voice sessions cost 2x credits due to speech processing.
            {quota && (
              <div>
                Voice sessions remaining: {quota.voice_sessions_limit - quota.voice_sessions_used}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={loading}
          className={styles.startButton}
        >
          {loading ? 'Starting...' : 'Start Session'}
        </button>
      </div>

      <div className={styles.infoCard}>
        <h3>How It Works</h3>
        <ol>
          <li><strong>Teach:</strong> Explain your chosen topic as if teaching a student</li>
          <li><strong>Interact:</strong> The AI will ask questions and seek clarifications</li>
          <li><strong>Correct:</strong> If you make errors, the AI will gently interrupt with corrections</li>
          <li><strong>Examine:</strong> Answer questions to demonstrate your understanding</li>
          <li><strong>Review:</strong> Get a comprehensive summary with personalized recommendations</li>
        </ol>
      </div>
    </div>
  );
}
