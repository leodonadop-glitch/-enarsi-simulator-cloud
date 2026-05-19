import { useMemo } from 'react';

function ResultsDashboard({ questions, results, stats, onReviewIncorrect, onJumpTo, onBackToDashboard }) {
  const incorrectQuestions = useMemo(() =>
    questions.map((q, idx) => ({ ...q, idx })).filter(q => results[q.id] === 'incorrect'), [questions, results]);

  const correctQuestions = useMemo(() =>
    questions.map((q, idx) => ({ ...q, idx })).filter(q => results[q.id] === 'correct'), [questions, results]);

  const scoreColor = stats.percentage >= 80 ? 'var(--success)' : stats.percentage >= 50 ? 'var(--lab-color)' : 'var(--danger)';
  const userScore = Math.round(stats.percentage * 10);
  const passed = userScore >= 825;

  return (
    <div className="results-dashboard">
      <div className="results-header-actions">
        <h2 className="results-title">📊 Session Results</h2>
        <button className="btn btn-secondary" onClick={onBackToDashboard}>🏠 Back to Dashboard</button>
      </div>

      <div className="score-card glass-panel">
        <div className="score-circle" style={{ borderColor: scoreColor }}>
          <span className="score-number" style={{ color: scoreColor }}>{stats.percentage}%</span>
          <span className="score-sublabel">Score</span>
        </div>
        <div className="score-details">
          <div className="score-row">
            <span className="score-detail-label">Answered</span>
            <span className="score-detail-value">{stats.answered} / {stats.total}</span>
          </div>
          <div className="score-row">
            <span className="score-detail-label" style={{ color: 'var(--success)' }}>✓ Correct</span>
            <span className="score-detail-value" style={{ color: 'var(--success)' }}>{stats.correct}</span>
          </div>
          <div className="score-row">
            <span className="score-detail-label" style={{ color: 'var(--danger)' }}>✗ Incorrect</span>
            <span className="score-detail-value" style={{ color: 'var(--danger)' }}>{stats.incorrect}</span>
          </div>
          <div className="score-row score-row-highlight">
            <span className="score-detail-label">Est. Score (1000)</span>
            <span className="score-detail-value" style={{ color: scoreColor, fontWeight: 700, fontSize: '1.2rem' }}>{userScore}</span>
          </div>
          {stats.answered > 0 && (
            <div className={`pass-fail-badge ${passed ? 'pass' : 'fail'}`}>
              {passed ? '🎉 PASS' : '📚 NEEDS STUDY'}
            </div>
          )}
        </div>
      </div>

      <div className="results-progress glass-panel">
        <h3>Progress</h3>
        <div className="results-bar-container">
          <div className="results-bar-segment correct-segment" style={{ width: `${(stats.correct / stats.total) * 100}%` }}></div>
          <div className="results-bar-segment incorrect-segment" style={{ width: `${(stats.incorrect / stats.total) * 100}%` }}></div>
        </div>
        <div className="results-bar-legend">
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--success)' }}></span> Correct</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--danger)' }}></span> Incorrect</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'rgba(255,255,255,0.1)' }}></span> Pending</span>
        </div>
      </div>

      {incorrectQuestions.length > 0 && (
        <div className="results-section glass-panel">
          <div className="results-section-header">
            <h3>❌ Incorrect ({incorrectQuestions.length})</h3>
            <button className="btn btn-review" onClick={onReviewIncorrect}>🔄 Review All</button>
          </div>
          <div className="results-list">
            {incorrectQuestions.map(q => (
              <button key={q.id} className="results-list-item incorrect-item" onClick={() => onJumpTo(q.idx)}>
                <span className="results-item-id">{q.isLab ? `Lab ${q.id}` : `Q${q.id}`}</span>
                <span className="results-item-preview">{q.questionText?.substring(0, 80)?.trim() || 'Click to view'}...</span>
                <span className="results-item-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {correctQuestions.length > 0 && (
        <details className="results-section glass-panel">
          <summary className="results-section-header clickable"><h3>✅ Correct ({correctQuestions.length})</h3></summary>
          <div className="results-list">
            {correctQuestions.map(q => (
              <button key={q.id} className="results-list-item correct-item" onClick={() => onJumpTo(q.idx)}>
                <span className="results-item-id">{q.isLab ? `Lab ${q.id}` : `Q${q.id}`}</span>
                <span className="results-item-preview">{q.questionText?.substring(0, 80)?.trim() || 'View'}...</span>
                <span className="results-item-arrow">→</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default ResultsDashboard;
