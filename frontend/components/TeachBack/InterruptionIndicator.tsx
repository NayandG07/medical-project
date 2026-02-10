/**
 * Interruption Indicator Component
 * 
 * Displays error corrections when the AI detects mistakes in teaching.
 */

import styles from '../../styles/TeachBack.module.css';

interface Error {
  error_text: string;
  correction: string;
  severity: string;
}

interface InterruptionIndicatorProps {
  interruption: {
    errors: Error[];
    message: string;
  };
  onAcknowledge: () => void;
}

export default function InterruptionIndicator({ interruption, onAcknowledge }: InterruptionIndicatorProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#dc2626'; // red
      case 'moderate':
        return '#f59e0b'; // orange
      case 'minor':
        return '#3b82f6'; // blue
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className={styles.interruption}>
      <div className={styles.interruptionHeader}>
        <span className={styles.interruptionIcon}>⚠️</span>
        <h3>Gentle Correction</h3>
      </div>

      <div className={styles.interruptionContent}>
        <p className={styles.interruptionMessage}>{interruption.message}</p>

        {interruption.errors && interruption.errors.length > 0 && (
          <div className={styles.errorsList}>
            {interruption.errors.map((error, index) => (
              <div 
                key={index} 
                className={styles.errorItem}
                style={{ borderLeftColor: getSeverityColor(error.severity) }}
              >
                <div className={styles.errorHeader}>
                  <span className={styles.errorSeverity}>
                    {error.severity.toUpperCase()}
                  </span>
                </div>
                <div className={styles.errorText}>
                  <strong>Issue:</strong> {error.error_text}
                </div>
                <div className={styles.errorCorrection}>
                  <strong>Correction:</strong> {error.correction}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.interruptionActions}>
        <button
          onClick={onAcknowledge}
          className={styles.acknowledgeButton}
        >
          I Understand - Continue Teaching
        </button>
      </div>
    </div>
  );
}
