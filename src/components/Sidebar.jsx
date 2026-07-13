import { useNavigate } from 'react-router-dom';

function Sidebar({ questions, currentIndex, onSelect, results, stats, session,
  currentView, reviewMode, onEnterReview, onExitReview,
  profile, onLogout, onEndSession, filteredIndices, onEndTest, reinforceMode, reinforceCorrectCounts }) {
  const navigate = useNavigate();
  const scoreColor = stats.percentage >= 80 ? 'var(--success)' : stats.percentage >= 50 ? 'var(--lab-color)' : 'var(--danger)';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-user-row">
          <h1>ENARSI Simulator</h1>
          <div className="user-info">
            <span className="user-name">👤 {profile?.display_name}</span>
            {profile?.is_admin && (
              <button className="btn-link" onClick={() => { navigate('/admin'); onExitReview(); }}>Admin</button>
            )}
            <button className="btn-link" onClick={onLogout}>Logout</button>
          </div>
        </div>

        {session && (
          <div className="session-badge">
            📚 {session.label} · Q{session.range_start}-{session.range_end}
            <button className="btn-link small" onClick={onEndSession}>Change</button>
          </div>
        )}

        <div className="sidebar-stats-grid">
          <div className="stat-box">
            <span className="stat-number" style={{ color: 'var(--success)' }}>{stats.correct}</span>
            <span className="stat-label">Correct</span>
          </div>
          <div className="stat-box">
            <span className="stat-number" style={{ color: 'var(--danger)' }}>{stats.incorrect}</span>
            <span className="stat-label">Wrong</span>
          </div>
          <div className="stat-box">
            <span className="stat-number" style={{ color: scoreColor }}>{stats.percentage}%</span>
            <span className="stat-label">Score</span>
          </div>
          <div className="stat-box">
            <span className="stat-number" style={{ color: 'var(--text-muted)' }}>{stats.unanswered}</span>
            <span className="stat-label">Left</span>
          </div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar-correct" style={{ width: `${(stats.correct / stats.total) * 100}%` }}></div>
          <div className="progress-bar-incorrect" style={{ width: `${(stats.incorrect / stats.total) * 100}%` }}></div>
        </div>

        <div className="sidebar-tabs">
          <button className={`tab-btn ${currentView === 'exam' && !reviewMode && !reinforceMode ? 'active' : ''}`}
            onClick={() => { navigate(session?.id ? `/session/${session.id}` : '/exam'); onExitReview(); }}>📝 Exam</button>
          <button className={`tab-btn ${currentView === 'results' ? 'active' : ''}`}
            onClick={() => navigate(session?.id ? `/session/${session.id}/results` : '/results')}>📊 Results</button>
          <button className={`tab-btn ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => navigate('/history')}>📈 History</button>
          <button className={`tab-btn review-tab ${reviewMode ? 'active' : ''}`}
            onClick={onEnterReview} disabled={stats.incorrect === 0}>
            🔄 ({stats.incorrect})
          </button>
        </div>
        
        {currentView === 'exam' && (
          <button className="btn btn-secondary" style={{ width: '100%', marginTop: '10px' }} onClick={onEndTest}>
            🏁 End Test
          </button>
        )}
      </div>

      <div className="grid-container">
        {questions.map((q, index) => {
          const isActive = index === currentIndex && currentView === 'exam';
          const result = results[q.id];
          const isFiltered = filteredIndices !== null && !filteredIndices.includes(index);

          let cls = 'grid-btn';
          if (isActive) cls += ' active';
          if (result === 'correct') cls += ' result-correct';
          if (result === 'incorrect') cls += ' result-incorrect';
          if (isFiltered) cls += ' filtered-out';
          if (q.isLab) cls += ' lab';

          return (
            <button key={q.id} className={cls} onClick={() => onSelect(index)}
              title={`${q.isLab ? 'Lab' : 'Q'}${q.id}${result ? ` (${result})` : ''}`}>
              {q.isLab ? 'L' : q.id}
              {reinforceMode && reinforceCorrectCounts[q.id] !== undefined && (
                <span className="reinforce-progress">{reinforceCorrectCounts[q.id]}/3</span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default Sidebar;
