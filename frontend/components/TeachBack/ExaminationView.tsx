/**
 * Examination View Component
 * 
 * Displays examination questions and handles answer submission.
 */

import { useState } from 'react';
import styles from '../../styles/TeachBack.module.css';

interface ExaminationViewProps {
  question: string;
  onSubmit: (question: string, answer: string) => void;
  loading: boolean;
}

export default function ExaminationView({ question, onSubmit, loading }: ExaminationViewProps) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    if (!answer.trim()) {
      alert('Please provide an answer');
      return;
    }

    onSubmit(question, answer);
    setAnswer('');
  };

  return (
    <div className={styles.examination}>
      <div className={styles.examinationHeader}>
        <h3>📋 Examination Phase</h3>
        <p>Answer the following question to demonstrate your understanding:</p>
      </div>

      <div className={styles.questionCard}>
        <div className={styles.questionLabel}>Question:</div>
        <div className={styles.questionText}>{question}</div>
      </div>

      <div className={styles.answerSection}>
        <label htmlFor="answer">Your Answer:</label>
        <textarea
          id="answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer here..."
          className={styles.answerTextarea}
          disabled={loading}
          rows={6}
        />
      </div>

      <div className={styles.examinationActions}>
        <button
          onClick={handleSubmit}
          disabled={loading || !answer.trim()}
          className={styles.submitButton}
        >
          {loading ? 'Submitting...' : 'Submit Answer'}
        </button>
      </div>

      <div className={styles.examinationTip}>
        <strong>Tip:</strong> Provide a detailed, well-explained answer. Your response will be evaluated on accuracy and completeness.
      </div>
    </div>
  );
}
