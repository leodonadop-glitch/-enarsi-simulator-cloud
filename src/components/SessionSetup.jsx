import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import OnlineStatus from './OnlineStatus';

const PRESETS = [
  { label: 'All Questions (1-463)', start: 1, end: 463 },
  { label: 'Questions 1-50', start: 1, end: 50 },
  { label: 'Questions 51-100', start: 51, end: 100 },
  { label: 'Questions 101-200', start: 101, end: 200 },
  { label: 'Questions 201-300', start: 201, end: 300 },
  { label: 'Questions 301-463', start: 301, end: 463 },
  { label: 'Labs Only (464-483)', start: 464, end: 483 },
];

function SessionSetup({ user, profile, onStartSession, onLogout, onStartReinforcement, onGoToAdmin }) {
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(483);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Reinforcement progress state
  const [weakCount, setWeakCount] = useState(0);
  const [loadingWeak, setLoadingWeak] = useState(true);

  // Activity and Streak state
  const [activityStats, setActivityStats] = useState({
    streak: 0,
    lastActive: null,
    inactiveDays: null,
    totalActiveDays: 0,
    status: 'loading' // 'loading', 'empty', 'error', 'today', 'yesterday', 'inactive-2-3', 'inactive-4'
  });

  const loadWeakCount = useCallback(async () => {
    setLoadingWeak(true);
    try {
      const { data: allAnswers } = await supabase
        .from('answers')
        .select('question_id, result, answered_at')
        .eq('user_id', user.id)
        .order('answered_at', { ascending: true });

      if (!allAnswers) {
        setWeakCount(0);
        setLoadingWeak(false);
        return;
      }

      const historyMap = {};
      allAnswers.forEach(a => {
        if (!historyMap[a.question_id]) {
          historyMap[a.question_id] = [];
        }
        historyMap[a.question_id].push(a.result);
      });

      let count = 0;
      Object.entries(historyMap).forEach(([qId, results]) => {
        const hasFail = results.includes('incorrect');
        if (!hasFail) return;

        let consecutiveCorrect = 0;
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i] === 'correct') {
            consecutiveCorrect++;
          } else {
            break;
          }
        }

        if (consecutiveCorrect < 3) {
          count++;
        }
      });

      setWeakCount(count);
    } catch (err) {
      console.error('Error loading weak count:', err);
    } finally {
      setLoadingWeak(false);
    }
  }, [user.id]);

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

  const loadActivityStats = useCallback(async () => {
    try {
      const { data: answers, error: answersError } = await supabase
        .from('answers')
        .select('answered_at')
        .eq('user_id', user.id)
        .order('answered_at', { ascending: false });

      if (answersError) {
        setActivityStats({
          streak: 0,
          lastActive: null,
          inactiveDays: null,
          totalActiveDays: 0,
          status: 'error'
        });
        return;
      }

      if (!answers || answers.length === 0) {
        setActivityStats({
          streak: 0,
          lastActive: null,
          inactiveDays: null,
          totalActiveDays: 0,
          status: 'empty'
        });
        return;
      }

      // Convert timestamps to unique local date strings (YYYY-MM-DD)
      const uniqueDateStrings = Array.from(new Set(
        answers.map(a => new Date(a.answered_at).toLocaleDateString('en-CA'))
      )).sort((a, b) => b.localeCompare(a)); // Sort descending (most recent first)

      const totalActiveDays = uniqueDateStrings.length;
      const lastActiveStr = uniqueDateStrings[0];
      
      // Parse local dates to compute difference correctly
      // Format en-CA yields YYYY-MM-DD which is safe to parse in timezone-independent way
      const parseDate = (dStr) => {
        const parts = dStr.split('-');
        return new Date(parts[0], parts[1] - 1, parts[2]);
      };

      const lastActiveDate = parseDate(lastActiveStr);

      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA');
      const todayDate = parseDate(todayStr);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString('en-CA');

      // Calculate difference in days calendar-wise
      const timeDiff = todayDate.getTime() - lastActiveDate.getTime();
      const inactiveDays = Math.max(0, Math.round(timeDiff / (1000 * 60 * 60 * 24)));

      // Calculate streak
      let streak = 0;
      if (lastActiveStr === todayStr || lastActiveStr === yesterdayStr) {
        let currentCheckDate = parseDate(lastActiveStr);
        while (true) {
          const checkStr = currentCheckDate.toLocaleDateString('en-CA');
          if (uniqueDateStrings.includes(checkStr)) {
            streak++;
            currentCheckDate.setDate(currentCheckDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      let status = 'empty';
      if (inactiveDays === 0) {
        status = 'today';
      } else if (inactiveDays === 1) {
        status = 'yesterday';
      } else if (inactiveDays >= 2 && inactiveDays <= 3) {
        status = 'inactive-2-3';
      } else if (inactiveDays >= 4) {
        status = 'inactive-4';
      }

      setActivityStats({
        streak,
        lastActive: lastActiveDate,
        inactiveDays,
        totalActiveDays,
        status
      });
    } catch (err) {
      console.error('Error loading activity stats:', err);
      setActivityStats(prev => ({ ...prev, status: 'error' }));
    }
  }, [user.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSessions();
      loadActivityStats();
      loadWeakCount();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSessions, loadActivityStats, loadWeakCount]);

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
          <div style={{ display: 'flex', gap: '10px' }}>
            {profile?.is_admin && (
              <button className="btn btn-secondary" onClick={onGoToAdmin}>🛠️ Admin</button>
            )}
            <button className="btn btn-logout" onClick={onLogout}>🚪 Logout</button>
          </div>
        </div>

        <div className="session-grid">
          {/* Actividad y Racha Card */}
          <div className="session-card glass-panel activity-card">
            <h2 className="session-card-title">🔥 Racha y Actividad</h2>
            {activityStats.status === 'loading' ? (
              <p className="text-muted">Cargando estadisticas...</p>
            ) : activityStats.status === 'error' ? (
              <p className="text-muted" style={{ color: 'var(--danger)' }}>Error al cargar datos de actividad</p>
            ) : (
              <div className="activity-container">
                <div className="streak-main">
                  <div className="streak-badge-large">
                    <span className="streak-icon">🔥</span>
                    <span className="streak-number">{activityStats.streak}</span>
                    <span className="streak-label">
                      {activityStats.streak === 1 ? 'Dia de racha' : 'Dias de racha'}
                    </span>
                  </div>
                </div>

                <div className="activity-stats-details">
                  <div className="activity-detail-item">
                    <span className="detail-label">Ultima actividad</span>
                    <span className="detail-value">
                      {activityStats.status === 'empty' 
                        ? 'Sin actividad' 
                        : activityStats.inactiveDays === 0 
                          ? 'Hoy' 
                          : activityStats.inactiveDays === 1 
                            ? 'Ayer' 
                            : `${activityStats.inactiveDays} dias atras`}
                    </span>
                  </div>
                  <div className="activity-detail-item">
                    <span className="detail-label">Total dias de estudio</span>
                    <span className="detail-value">{activityStats.totalActiveDays} dias</span>
                  </div>
                </div>

                {activityStats.status === 'today' && (
                  <div className="activity-status-msg active-today">
                    Racha activa. Sigue estudiando para mantenerla.
                  </div>
                )}
                {activityStats.status === 'yesterday' && (
                  <div className="activity-status-msg active-yesterday">
                    Estudiaste ayer. Haz tu sesion de hoy para no perder tu racha.
                  </div>
                )}
                {activityStats.status === 'inactive-2-3' && (
                  <div className="activity-status-msg inactive-warning">
                    Llevas {activityStats.inactiveDays} dias inactivo. Estudia hoy para reactivar tu racha.
                  </div>
                )}
                {activityStats.status === 'inactive-4' && (
                  <div className="activity-status-msg inactive-critical">
                    Llevas {activityStats.inactiveDays} dias inactivo. Retoma tu estudio hoy.
                  </div>
                )}
                {activityStats.status === 'empty' && (
                  <div className="activity-status-msg no-activity">
                    Comienza tu primera sesion de estudio para iniciar tu racha.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Compañeros en línea Card */}
          <OnlineStatus user={user} />

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
                  onChange={(e) => setRangeStart(e.target.value === '' ? '' : parseInt(e.target.value))}
                  onBlur={(e) => setRangeStart(Math.max(1, Math.min(483, parseInt(e.target.value) || 1)))} />
              </div>
              <span className="range-dash">→</span>
              <div className="form-group">
                <label className="form-label">To</label>
                <input type="number" className="form-input" min={1} max={483} value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value === '' ? '' : parseInt(e.target.value))}
                  onBlur={(e) => setRangeEnd(Math.max(1, Math.min(483, parseInt(e.target.value) || 483)))} />
              </div>
            </div>

            <button className="btn btn-auth" onClick={handleCreateSession} disabled={creating || rangeStart === '' || rangeEnd === '' || rangeStart > rangeEnd}>
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
            <h2 className="session-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔥 Reinforcement</span>
              {!loadingWeak && (
                <span className="badge" style={{ 
                  background: weakCount > 0 ? 'rgba(249,115,22,0.15)' : 'rgba(34,197,94,0.15)',
                  color: weakCount > 0 ? '#f97316' : '#22c55e',
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: weakCount > 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(34,197,94,0.3)'
                }}>
                  {weakCount} left
                </span>
              )}
            </h2>
            <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
              {loadingWeak ? (
                'Calculating reinforcement progress...'
              ) : weakCount > 0 ? (
                <>Practice questions you've failed at least once. Get them right 3 times in a row to clear them.</>
              ) : (
                <>🎉 Excellent! You have cleared all weak questions by answering them correctly 3 times consecutively.</>
              )}
            </p>
            <button 
              className="btn btn-reinforce" 
              onClick={onStartReinforcement}
              disabled={loadingWeak || weakCount === 0}
              style={{
                opacity: (loadingWeak || weakCount === 0) ? 0.6 : 1,
                cursor: (loadingWeak || weakCount === 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingWeak ? 'Loading...' : weakCount === 0 ? 'All Clear!' : 'Start Reinforcement Mode'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SessionSetup;
