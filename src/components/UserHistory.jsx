import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

function UserHistory({ user, onJumpTo, questions }) {
  const [sessions, setSessions] = useState([]);
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({ total: 0, correct: 0, incorrect: 0 });
  const [sessionStatsMap, setSessionStatsMap] = useState({});

  const loadHistory = useCallback(async () => {
    // Load all sessions (active and inactive)
    const { data: sessData } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setSessions(sessData || []);

    // Load all answers to compute recurring failures
    const { data: ansData } = await supabase
      .from('answers')
      .select('question_id, result, session_id')
      .eq('user_id', user.id);

    if (ansData) {
      // Compute stats
      const correct = ansData.filter(a => a.result === 'correct').length;
      const incorrect = ansData.filter(a => a.result === 'incorrect').length;
      setTotalStats({ total: ansData.length, correct, incorrect });

      // Compute recurring failures
      const failMap = {};
      ansData.forEach(a => {
        if (!failMap[a.question_id]) failMap[a.question_id] = { fails: 0, passes: 0 };
        if (a.result === 'incorrect') failMap[a.question_id].fails++;
        else failMap[a.question_id].passes++;
      });

      const recurringList = Object.entries(failMap)
        .filter(([, v]) => v.fails >= 2)
        .map(([qId, v]) => ({ questionId: parseInt(qId), ...v }))
        .sort((a, b) => b.fails - a.fails);

      setFailures(recurringList);

      // Compute per-session score stats
      const nextSessionStats = {};
      ansData.forEach(a => {
        if (!a.session_id) return;
        if (!nextSessionStats[a.session_id]) {
          nextSessionStats[a.session_id] = { correct: 0, incorrect: 0, total: 0 };
        }
        nextSessionStats[a.session_id].total += 1;
        if (a.result === 'correct') nextSessionStats[a.session_id].correct += 1;
        if (a.result === 'incorrect') nextSessionStats[a.session_id].incorrect += 1;
      });
      setSessionStatsMap(nextSessionStats);
    } else {
      setSessionStatsMap({});
    }

    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadHistory]);

  if (loading) return <div className="results-dashboard"><p className="text-muted">Loading history...</p></div>;

  return (
    <div className="results-dashboard">
      <h2 className="results-title">📈 Your History</h2>

      {/* Global Stats */}
      <div className="score-card glass-panel">
        <div className="score-details" style={{ width: '100%' }}>
          <h3 style={{ marginBottom: '12px' }}>All-Time Stats</h3>
          <div className="score-row">
            <span className="score-detail-label">Total Answers</span>
            <span className="score-detail-value">{totalStats.total}</span>
          </div>
          <div className="score-row">
            <span className="score-detail-label" style={{ color: 'var(--success)' }}>✓ Correct</span>
            <span className="score-detail-value" style={{ color: 'var(--success)' }}>{totalStats.correct}</span>
          </div>
          <div className="score-row">
            <span className="score-detail-label" style={{ color: 'var(--danger)' }}>✗ Incorrect</span>
            <span className="score-detail-value" style={{ color: 'var(--danger)' }}>{totalStats.incorrect}</span>
          </div>
          <div className="score-row score-row-highlight">
            <span className="score-detail-label">Overall Accuracy</span>
            <span className="score-detail-value" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {totalStats.total > 0 ? Math.round((totalStats.correct / totalStats.total) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Recurring Failures */}
      {failures.length > 0 && (
        <div className="results-section glass-panel">
          <div className="results-section-header">
            <h3>🔥 Recurring Failures ({failures.length})</h3>
          </div>
          <p className="text-muted" style={{ marginBottom: '12px', fontSize: '0.8rem' }}>
            Questions you've gotten wrong 2+ times across all sessions
          </p>
          <div className="results-list">
            {failures.map(f => {
              const q = questions.find(q => q.id === f.questionId);
              const idx = questions.findIndex(q => q.id === f.questionId);
              return (
                <button key={f.questionId} className="results-list-item incorrect-item" onClick={() => idx >= 0 && onJumpTo(idx)}>
                  <span className="results-item-id">Q{f.questionId}</span>
                  <span className="fail-count-badge">{f.fails}× failed</span>
                  <span className="results-item-preview">
                    {q?.questionText?.substring(0, 60)?.trim() || ''}
                  </span>
                  <span className="results-item-arrow">→</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Sessions */}
      <div className="results-section glass-panel">
        <div className="results-section-header">
          <h3>📂 Session History ({sessions.length})</h3>
        </div>
        {sessions.length === 0 ? (
          <p className="text-muted">No sessions yet</p>
        ) : (
          <div className="results-list">
            {sessions.map(s => {
              const sessionStats = sessionStatsMap[s.id] || { correct: 0, total: 0 };
              const accuracy = sessionStats.total > 0
                ? Math.round((sessionStats.correct / sessionStats.total) * 100)
                : 0;
              const scoreColor = accuracy >= 70 ? 'var(--success)' : 'var(--danger)';
              const performanceLabel = sessionStats.total === 0
                ? 'No answers yet'
                : accuracy >= 85
                  ? 'Strong'
                  : accuracy >= 70
                    ? 'On track'
                    : 'Needs review';
              const performanceBg = sessionStats.total === 0
                ? 'rgba(255,255,255,0.08)'
                : accuracy >= 70
                  ? 'rgba(34,197,94,0.18)'
                  : 'rgba(239,68,68,0.18)';
              const performanceColor = sessionStats.total === 0
                ? 'var(--text-muted)'
                : accuracy >= 70
                  ? 'var(--success)'
                  : 'var(--danger)';

              return (
                <div key={s.id} className="results-list-item" style={{ cursor: 'default' }}>
                  <span className="results-item-id">{s.label}</span>
                  <span className="results-item-preview">
                    Last: Q{s.last_question_id} · {s.is_active ? '🟢 Active' : '⚪ Closed'}
                  </span>
                  <span className="results-item-preview" style={{ color: scoreColor, fontWeight: 600 }}>
                    Score: {sessionStats.correct} / {sessionStats.total} ({accuracy}%)
                  </span>
                  <span
                    className="results-item-preview"
                    style={{
                      color: performanceColor,
                      background: performanceBg,
                      borderRadius: '999px',
                      padding: '2px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      width: 'fit-content',
                    }}
                  >
                    {performanceLabel}
                  </span>
                  <span className="results-item-arrow" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserHistory;
