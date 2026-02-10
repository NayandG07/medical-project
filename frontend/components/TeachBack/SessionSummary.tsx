/**
 * Session Summary Component
 * 
 * Displays comprehensive session summary with scores and recommendations.
 */

import styles from '../../styles/TeachBack.module.css';

interface Summary {
  total_errors: number;
  missed_concepts: string[];
  strong_areas: string[];
  recommendations: string[];
  overall_score: number;
}

interface SessionSummaryProps {
  summary: Summary;
  onNewSession: () => void;
}

export default function SessionSummary({ summary, onNewSession }: SessionSummaryProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // orange
    return '#dc2626'; // red
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className={styles.summary}>
      <div className={styles.summaryHeader}>
        <h2>✅ Session Complete!</h2>
        <p>Here's your comprehensive learning summary</p>
      </div>

      {/* Overall Score */}
      <div className={styles.scoreCard}>
        <div className={styles.scoreCircle} style={{ borderColor: getScoreColor(summary.overall_score) }}>
          <div className={styles.scoreValue} style={{ color: getScoreColor(summary.overall_score) }}>
            {summary.overall_score}
          </div>
          <div className={styles.scoreLabel}>{getScoreLabel(summary.overall_score)}</div>
        </div>
        <div className={styles.scoreDetails}>
          <div className={styles.scoreDetail}>
            <span className={styles.detailLabel}>Total Errors:</span>
            <span className={styles.detailValue}>{summary.total_errors}</span>
          </div>
        </div>
      </div>

      {/* Missed Concepts */}
      {summary.missed_concepts && summary.missed_concepts.length > 0 && (
        <div className={styles.summarySection}>
          <h3>📚 Concepts to Review</h3>
          <ul className={styles.conceptList}>
            {summary.missed_concepts.map((concept, index) => (
              <li key={index} className={styles.conceptItem}>
                {concept}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strong Areas */}
      {summary.strong_areas && summary.strong_areas.length > 0 && (
        <div className={styles.summarySection}>
          <h3>💪 Strong Areas</h3>
          <ul className={styles.conceptList}>
            {summary.strong_areas.map((area, index) => (
              <li key={index} className={styles.conceptItem}>
                {area}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {summary.recommendations && summary.recommendations.length > 0 && (
        <div className={styles.summarySection}>
          <h3>💡 Personalized Recommendations</h3>
          <ul className={styles.recommendationList}>
            {summary.recommendations.map((rec, index) => (
              <li key={index} className={styles.recommendationItem}>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className={styles.summaryActions}>
        <button
          onClick={onNewSession}
          className={styles.newSessionButton}
        >
          Start New Session
        </button>
        <button
          onClick={() => window.print()}
          className={styles.printButton}
        >
          Print Summary
        </button>
      </div>
    </div>
  );
}
