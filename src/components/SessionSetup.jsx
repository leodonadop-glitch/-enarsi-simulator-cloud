import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const PRESETS = [
  { label: 'All Questions (1-463)', start: 1, end: 463 },
  { label: 'Questions 1-50', start: 1, end: 50 },
  { label: 'Questions 51-100', start: 51, end: 100 },
  { label: 'Questions 101-200', start: 101, end: 200 },
  { label: 'Questions 201-300', start: 201, end: 300 },
  { label: 'Questions 301-463', start: 301, end: 463 },
  { label: 'Labs Only (464-483)', start: 464, end: 483 },
];

function SessionSetup({ user, profile, onStartSession, onLogout, onStartReinforcement }) {
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(483);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadSessions = useCallback(async () => {
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (!sessions) {
      setActiveSessions([]);
      setLoading(false);
      return;
    }

    const sessionIds = sessions.map(s => s.id);
    const sessionStats = {};

    if (sessionIds.length > 0) {
      const { data: answers } = await supabase
        .from('answers')
        .select('session_id, result')
        .in('session_id', sessionIds);

      if (answers) {
        answers.forEach(ans => {
          if (!sessionStats[ans.session_id]) {
            sessionStats[ans.session_id] = { correct: 0, incorrect: 0, total: 0 };
          }
          sessionStats[ans.session_id].total++;
          if (ans.result === 'correct') sessionStats[ans.session_id].correct++;
          else if (ans.result === 'incorrect') sessionStats[ans.session_id].incorrect++;
        });
      }
    }

    const sessionsWithStats = sessions.map(s => {
      const stats = sessionStats[s.id] || { correct: 0, incorrect: 0, total: 0 };
      const totalRange = s.range_end - s.range_start + 1;
      const progressPercent = totalRange > 0 ? Math.round((stats.total / totalRange) * 100) : 0;
      return {
        ...s,
        stats,
        progressPercent,
      };
    });

    setActiveSessions(sessionsWithStats);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSessions]);

  const handleCreateSession = async () => {
    setCreating(true);
    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: user.id,
        label: `Q${rangeStart}-${rangeEnd}`,
        range_start: rangeStart,
        range_end: rangeEnd,
        last_question_id: rangeStart,
      })
      .select()
      .single();

    if (!error && data) {
      onStartSession(data);
    }
    setCreating(false);
  };

  const handleResumeSession = (session) => {
    onStartSession(session);
  };

  const handleDeleteSession = async (id) => {
    await supabase.from('study_sessions').update({ is_active: false }).eq('id', id);
    loadSessions();
  };

  const applyPreset = (preset) => {
    setRangeStart(preset.start);
    setRangeEnd(preset.end);
  };

  return (
    <div className="session-page">
      <div className="auth-bg-glow"></div>
      <div className="session-container">
        {/* Header */}
        <div className="session-header">
          <h1 className="auth-title">Welcome, {profile?.display_name || 'Student'}!</h1>
          <p className="auth-desc">Set up your study session</p>
          <button className="btn btn-logout" onClick={onLogout}>🚪 Logout</button>
        </div>

        <div className="session-grid">
          {/* New Session Card */}
          <div className="session-card glass-panel">
            <h2 className="session-card-title">📝 New Session</h2>

            <div className="presets-grid">
              {PRESETS.map((p, i) => (
                <button key={i} className="btn btn-preset" onClick={() => applyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>

            <div className="range-controls">
              <div className="form-group">
                <label className="form-label">From</label>
                <input type="number" className="form-input" min={1} max={483} value={rangeStart}
                  onChange={(e) => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <span className="range-dash">→</span>
              <div className="form-group">
                <label className="form-label">To</label>
                <input type="number" className="form-input" min={1} max={483} value={rangeEnd}
                  onChange={(e) => setRangeEnd(Math.min(483, parseInt(e.target.value) || 483))} />
              </div>
            </div>

            <button className="btn btn-auth" onClick={handleCreateSession} disabled={creating || rangeStart > rangeEnd}>
              {creating ? '⏳ Creating...' : `🚀 Start (${rangeEnd - rangeStart + 1} questions)`}
            </button>
          </div>

          {/* Active Sessions Card */}
          <div className="session-card glass-panel">
            <h2 className="session-card-title">📂 Resume Session</h2>
            {loading ? (
              <p className="text-muted">Loading...</p>
            ) : activeSessions.length === 0 ? (
              <p className="text-muted">No active sessions. Create one to start!</p>
            ) : (
              <div className="sessions-list">
                {activeSessions.map((s) => (
                  <div key={s.id} className="session-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="session-item-info">
                        <span className="session-item-label" style={{ fontSize: '1.1rem', fontWeight: 600 }}>{s.label}</span>
                        <span className="session-item-meta" style={{ marginTop: '2px', display: 'block' }}>
                          Last: Q{s.last_question_id} · {new Date(s.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="session-item-actions" style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleResumeSession(s)}>
                          ▶ Resume
                        </button>
                        <button className="btn btn-danger-sm" onClick={() => handleDeleteSession(s.id)}>
                          ✕
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Done: <strong>{s.stats?.total || 0}</strong> / {s.range_end - s.range_start + 1}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ color: 'var(--success)' }}>✓ {s.stats?.correct || 0}</span>
                        <span style={{ color: 'var(--danger)' }}>✗ {s.stats?.incorrect || 0}</span>
                      </div>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.progressPercent}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ 
                      width: '100%', 
                      height: '6px', 
                      background: 'rgba(255,255,255,0.08)', 
                      borderRadius: '3px', 
                      overflow: 'hidden',
                      display: 'flex'
                    }}>
                      <div style={{ 
                        width: `${s.progressPercent}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, var(--accent) 0%, var(--success) 100%)', 
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reinforcement Card */}
          <div className="session-card glass-panel reinforce-card">
            <h2 className="session-card-title">🔥 Reinforcement</h2>
            <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
              Practice questions you've failed at least once. Get them right 3 times in a row to clear them!
            </p>
            <button className="btn btn-reinforce" onClick={onStartReinforcement}>
              Start Reinforcement Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SessionSetup;
