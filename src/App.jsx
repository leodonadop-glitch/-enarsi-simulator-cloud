import { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useMatch } from 'react-router-dom';
import './index.css';
import allQuestions from './data.json';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import SessionSetup from './components/SessionSetup';
import Sidebar from './components/Sidebar';
import QuestionViewer from './components/QuestionViewer';
import ResultsDashboard from './components/ResultsDashboard';
import UserHistory from './components/UserHistory';
import AdminPanel from './components/AdminPanel';

// Protected route for admin-only access
function ProtectedRoute({ profile, element }) {
  if (!profile?.is_admin) {
    return <Navigate to="/" replace />;
  }
  return element;
}

// Extract correct answer from answerText
function extractCorrectAnswer(answerText) {
  if (!answerText) return [];
  const match = answerText.match(/Answer[.:]\s*([A-E,\s]+)/i);
  if (!match) return [];
  return match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-E]/i.test(c)).map(c => c.toUpperCase());
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionMatch = useMatch('/session/:sessionId');
  const resultsMatch = useMatch('/session/:sessionId/results');
  const urlSessionId = sessionMatch?.params?.sessionId || resultsMatch?.params?.sessionId;
  const [sessionHydrating, setSessionHydrating] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState({});
  const [failCounts, setFailCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [jumpValue, setJumpValue] = useState('');
  const [currentView, setCurrentView] = useState('exam');
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewList, setReviewList] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedLetters, setSelectedLetters] = useState({}); // { qId: ['A'] }
  const [reinforceMode, setReinforceMode] = useState(false);
  const [reinforceCorrectCounts, setReinforceCorrectCounts] = useState({}); // { qId: consecutiveCorrectCount }
  const [isFullscreen, setIsFullscreen] = useState(false);

  async function loadProfile(userId, userObj) {
    try {
      // Fetch admin status first
      let isAdmin = false;
      try {
        const { data: adminData, error: adminError } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
        if (!adminError && adminData) {
          isAdmin = true;
        }
      } catch (adminErr) {
        console.error('Error verifying admin role:', adminErr);
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
      }

      if (!data && userObj) {
        // Fallback: If profile row is missing (e.g. signed up before trigger), insert it.
        const defaultName = userObj.user_metadata?.display_name || userObj.email?.split('@')[0] || 'Student';
        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, display_name: defaultName })
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('Error auto-creating missing profile:', insertError);
        } else if (inserted) {
          inserted.is_admin = isAdmin;
          setProfile(inserted);
          return;
        }
      }

      if (data) {
        data.is_admin = isAdmin;
      }
      setProfile(data);
    } catch (err) {
      console.error('Profile load exception:', err);
    }
  }

  // ========== AUTH ==========
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id, session.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id, session.user);
      else { setProfile(null); setSession(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ========== PRESENCE HEARTBEAT ==========
  useEffect(() => {
    if (!user) return;

    const updatePresence = async () => {
      try {
        const { error, status } = await supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', user.id)
          .select();
        
        if (error) {
          console.error('Error updating presence:', error.message);
        } else {
          console.log(`Presence updated successfully. HTTP Status: ${status}`);
        }
      } catch (err) {
        console.error('Heartbeat error:', err);
      }
    };

    // Run immediately
    updatePresence();

    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null); setResults({}); setCurrentIndex(0); setReinforceMode(false);
  };

  // ========== SESSION ==========
  const handleStartSession = useCallback(async (sess) => {
    setSession(sess);
    const filtered = allQuestions.filter(q => q.id >= sess.range_start && q.id <= sess.range_end);
    setQuestions(filtered);
    const resumeIdx = filtered.findIndex(q => q.id === sess.last_question_id);
    setCurrentIndex(resumeIdx >= 0 ? resumeIdx : 0);

    const { data: answers } = await supabase
      .from('answers').select('question_id, result').eq('session_id', sess.id);
    if (answers) {
      const resMap = {};
      answers.forEach(a => { resMap[a.question_id] = a.result; });
      setResults(resMap);
    }
    const { data: allAnswers } = await supabase
      .from('answers').select('question_id, result').eq('user_id', user.id);
    if (allAnswers) {
      const fc = {};
      allAnswers.forEach(a => { if (a.result === 'incorrect') fc[a.question_id] = (fc[a.question_id] || 0) + 1; });
      setFailCounts(fc);
    }
    setShowAnswer(false); setCurrentView('exam'); setReviewMode(false); setReinforceMode(false);
  }, [user]);

  // ========== REINFORCEMENT MODE ==========
  const handleStartReinforcement = useCallback(async () => {
    const { data: allAnswers } = await supabase
      .from('answers')
      .select('question_id, result, answered_at')
      .eq('user_id', user.id)
      .order('answered_at', { ascending: true });

    if (!allAnswers) return;

    const historyMap = {};
    allAnswers.forEach(a => {
      if (!historyMap[a.question_id]) {
        historyMap[a.question_id] = [];
      }
      historyMap[a.question_id].push(a.result);
    });

    const correctCounts = {};
    const weakIds = [];

    Object.entries(historyMap).forEach(([qIdStr, results]) => {
      const qId = parseInt(qIdStr);
      const hasFail = results.includes('incorrect');
      if (!hasFail) return; // Never failed

      let consecutiveCorrect = 0;
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] === 'correct') {
          consecutiveCorrect++;
        } else {
          break;
        }
      }

      correctCounts[qId] = consecutiveCorrect;

      if (consecutiveCorrect < 3) {
        weakIds.push(qId);
      }
    });

    if (weakIds.length === 0) {
      alert('🎉 No weak questions found! You\'re doing great!');
      navigate('/');
      return;
    }

    // Sort weakIds by total failures descending (to prioritize most failed questions)
    const failCountsMap = {};
    allAnswers.forEach(a => {
      if (a.result === 'incorrect') {
        failCountsMap[a.question_id] = (failCountsMap[a.question_id] || 0) + 1;
      }
    });
    weakIds.sort((a, b) => (failCountsMap[b] || 0) - (failCountsMap[a] || 0));

    const filtered = allQuestions.filter(q => weakIds.includes(q.id));
    filtered.sort((a, b) => weakIds.indexOf(a.id) - weakIds.indexOf(b.id));

    setQuestions(filtered);
    setCurrentIndex(0);
    setResults({});
    setSelectedLetters({});
    setReinforceMode(true);
    setReinforceCorrectCounts(correctCounts);
    setShowAnswer(false);
    setCurrentView('exam');
    setSession({ id: 'reinforce', label: '🔥 Reinforcement', range_start: 0, range_end: 999 });
  }, [user, navigate]);

  useEffect(() => {
    if (!user || !urlSessionId) {
      setSessionHydrating(false);
      return;
    }
    if (session?.id !== urlSessionId) {
      if (urlSessionId === 'reinforce') {
        const loadReinforcement = async () => {
          setSessionHydrating(true);
          await handleStartReinforcement();
          setSessionHydrating(false);
        };
        loadReinforcement();
      } else {
        const load = async () => {
          setSessionHydrating(true);
          const { data: sessionData, error } = await supabase
            .from('study_sessions')
            .select('*')
            .eq('id', urlSessionId)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          if (error || !sessionData) {
            navigate('/');
          } else {
            await handleStartSession(sessionData);
          }
          setSessionHydrating(false);
        };
        load();
      }
    }
  }, [user, urlSessionId, session?.id, navigate, handleStartSession, handleStartReinforcement]);

  const handleEndSession = () => {
    setSession(null); setResults({}); setCurrentIndex(0); setReviewMode(false);
    setReinforceMode(false); setSelectedLetters({});
  };

  const handleEndTest = () => { setCurrentView('results'); };
  const handleBackToDashboard = () => { handleEndSession(); };

  // ========== EXAM LOGIC ==========
  const currentQuestion = questions[currentIndex];

  const filteredIndices = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return questions.map((question, idx) => ({ question, idx }))
      .filter(({ question }) => {
        const text = (question.questionText || '') + ' ' + (question.answerText || '');
        return text.toLowerCase().includes(q) || String(question.id).includes(q);
      }).map(({ idx }) => idx);
  }, [searchQuery, questions]);

  const getNavList = useCallback(() => {
    if (reviewMode && reviewList.length > 0) return reviewList;
    return questions.map((_, i) => i);
  }, [reviewMode, reviewList, questions]);

  const handleNext = () => {
    // Auto-verify on navigate if answer not shown
    if (currentQuestion && !showAnswer && selectedLetters[currentQuestion.id]?.length > 0) {
      autoVerifyAndMark();
    }
    const navList = getNavList();
    const pos = navList.indexOf(currentIndex);
    if (pos < navList.length - 1) { setCurrentIndex(navList[pos + 1]); setShowAnswer(false); }
  };

  const handlePrev = () => {
    const navList = getNavList();
    const pos = navList.indexOf(currentIndex);
    if (pos > 0) { setCurrentIndex(navList[pos - 1]); setShowAnswer(false); }
  };

  const jumpToQuestion = (index) => {
    setCurrentIndex(index); setShowAnswer(false); setSidebarOpen(false);
    if (currentView !== 'exam') setCurrentView('exam');
  };

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(jumpValue, 10);
    if (!isNaN(num)) {
      const idx = questions.findIndex(q => q.id === num);
      if (idx !== -1) { jumpToQuestion(idx); setJumpValue(''); }
    }
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    autoVerifyAndMark();
  };

  const autoVerifyAndMark = async () => {
    if (!currentQuestion) return;
    const selected = selectedLetters[currentQuestion.id] || [];
    let result = 'incorrect';

    if (currentQuestion.type === 'drag_and_drop' || currentQuestion.type === 'drag_and_drop_code') {
      if (selected.length === 0) return; // User hasn't selected anything
      const correctMapping = currentQuestion.dragDropData?.correctMapping || {};
      const expectedArray = [];
      for (const [target, items] of Object.entries(correctMapping)) {
        expectedArray.push(`${target}|${items[0]}`);
      }
      const s1 = [...selected].sort().join('');
      const s2 = expectedArray.sort().join('');
      result = s1 === s2 ? 'correct' : 'incorrect';
    } else {
      const correct = currentQuestion.correctAnswer ? currentQuestion.correctAnswer.split('') : extractCorrectAnswer(currentQuestion.answerText);
      if (selected.length === 0 || correct.length === 0) return;
      const s1 = [...selected].sort().join('');
      const s2 = [...correct].sort().join('');
      result = s1 === s2 ? 'correct' : 'incorrect';
    }

    setResults(prev => ({ ...prev, [currentQuestion.id]: result }));

    // Save to Supabase (save reinforcement answers too, but without session_id)
    if (session?.id) {
      const insertData = {
        user_id: user.id,
        question_id: currentQuestion.id,
        result,
      };
      if (session.id !== 'reinforce') {
        insertData.session_id = session.id;
      }
      await supabase.from('answers').insert(insertData);

      if (session.id !== 'reinforce') {
        await supabase.from('study_sessions')
          .update({ last_question_id: currentQuestion.id, updated_at: new Date().toISOString() })
          .eq('id', session.id);
        setSession(prev => prev ? { ...prev, last_question_id: currentQuestion.id } : null);
      }
    }

    if (result === 'incorrect') {
      setFailCounts(prev => ({ ...prev, [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1 }));
    }

    // Reinforcement: track consecutive correct
    if (reinforceMode) {
      if (result === 'correct') {
        setReinforceCorrectCounts(prev => {
          const newCount = (prev[currentQuestion.id] || 0) + 1;
          const updated = { ...prev, [currentQuestion.id]: newCount };
          // Remove from list after 3 consecutive correct
          if (newCount >= 3) {
            setTimeout(() => {
              setQuestions(qs => qs.filter(q => q.id !== currentQuestion.id));
            }, 500);
          }
          return updated;
        });
      } else {
        setReinforceCorrectCounts(prev => ({ ...prev, [currentQuestion.id]: 0 }));
      }
    }
  };

  const handleMarkResult = async (result) => {
    if (!currentQuestion || !session) return;
    setResults(prev => ({ ...prev, [currentQuestion.id]: result }));

    const insertData = {
      user_id: user.id,
      question_id: currentQuestion.id,
      result,
    };

    if (session.id !== 'reinforce') {
      // Prevent duplicates if user toggles mark multiple times in same session
      await supabase.from('answers')
        .delete()
        .match({ session_id: session.id, question_id: currentQuestion.id });
      insertData.session_id = session.id;
    }

    await supabase.from('answers').insert(insertData);

    if (result === 'incorrect') {
      setFailCounts(prev => ({ ...prev, [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1 }));
    }

    if (session.id !== 'reinforce') {
      await supabase.from('study_sessions')
        .update({ last_question_id: currentQuestion.id, updated_at: new Date().toISOString() })
        .eq('id', session.id);
      setSession(prev => prev ? { ...prev, last_question_id: currentQuestion.id } : null);
    } else {
      // If manually marked in reinforcement mode, we also update consecutive correct count
      if (result === 'correct') {
        setReinforceCorrectCounts(prev => {
          const newCount = (prev[currentQuestion.id] || 0) + 1;
          const updated = { ...prev, [currentQuestion.id]: newCount };
          if (newCount >= 3) {
            setTimeout(() => {
              setQuestions(qs => qs.filter(q => q.id !== currentQuestion.id));
            }, 500);
          }
          return updated;
        });
      } else {
        setReinforceCorrectCounts(prev => ({ ...prev, [currentQuestion.id]: 0 }));
      }
    }
  };

  const handleSelectLetter = (qId, letters) => {
    setSelectedLetters(prev => ({ ...prev, [qId]: letters }));
  };

  const enterReviewMode = () => {
    const incorrectIndices = questions.map((q, idx) => ({ q, idx }))
      .filter(({ q }) => results[q.id] === 'incorrect').map(({ idx }) => idx);
    setReviewList(incorrectIndices); setReviewMode(true); setCurrentView('exam');
    if (incorrectIndices.length > 0) { setCurrentIndex(incorrectIndices[0]); setShowAnswer(false); }
  };

  const exitReviewMode = () => setReviewMode(false);

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
      if (isEditable || hasModifier) return;
      if (e.key === 'ArrowRight' || e.key === 'n') handleNext();
      if (e.key === 'ArrowLeft' || e.key === 'p') handlePrev();
      if (e.key === 'r' && !showAnswer) handleShowAnswer();
      if (e.key === 'f' || e.key === 'F') setIsFullscreen(prev => !prev);
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const stats = useMemo(() => {
    const correct = Object.values(results).filter(r => r === 'correct').length;
    const incorrect = Object.values(results).filter(r => r === 'incorrect').length;
    const answered = correct + incorrect;
    const total = questions.length;
    const percentage = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    return { correct, incorrect, answered, total, unanswered: total - answered, percentage };
  }, [results, questions]);

  // ========== RENDER ==========
  if (authLoading || (user && !profile)) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!user) {
    return <AuthScreen />;
  }

  // Navigation wrappers
  const startSessionWrapper = async (sess) => {
    await handleStartSession(sess);
    navigate(`/session/${sess.id}`);
  };

  const reinforcementWrapper = async () => {
    await handleStartReinforcement();
    navigate('/session/reinforce');
  };

  const endTestWrapper = () => {
    handleEndTest();
    if (session?.id) navigate(`/session/${session.id}/results`);
  };

  const reviewIncorrectWrapper = () => {
    enterReviewMode();
    if (session?.id) navigate(`/session/${session.id}`);
  };

  const jumpQuestionWrapper = (idx) => {
    jumpToQuestion(idx);
    if (session?.id) navigate(`/session/${session.id}`);
  };

  const backDashboardWrapper = () => {
    handleBackToDashboard();
    navigate('/');
  };

  // Derive currentView from URL pathname
  let pathCurrentView = 'exam'; // default
  if (location.pathname === '/') pathCurrentView = 'home';
  else if (location.pathname === '/exam' || sessionMatch) pathCurrentView = 'exam';
  else if (location.pathname === '/results' || resultsMatch) pathCurrentView = 'results';
  else if (location.pathname === '/history') pathCurrentView = 'history';
  else if (location.pathname === '/admin') pathCurrentView = 'admin';

  // Admin view
  if (pathCurrentView === 'admin') {
    return (
      <ProtectedRoute profile={profile} element={
        <div className="app-container admin-app-shell">
          <main className="main-area admin-main-area">
            <div className="content-scroll admin-content-scroll">
              <AdminPanel profile={profile} onBack={() => navigate(session && session.id !== 'reinforce' ? `/session/${session.id}` : session ? '/exam' : '/')} />
            </div>
          </main>
        </div>
      } />
    );
  }

  // Home view (no session)
  if (sessionHydrating) return <div className="loading-screen"><div className="spinner"></div></div>;

  if (pathCurrentView === 'home' || !session) {
    return <SessionSetup user={user} profile={profile} onStartSession={startSessionWrapper}
      onLogout={handleLogout} onStartReinforcement={reinforcementWrapper} onGoToAdmin={() => navigate('/admin')} />;
  }

  // Exam view with session
  const navList = getNavList();
  const posInList = navList.indexOf(currentIndex);

  const examElement = (
    <>
      <header className="top-bar">
        <div className="top-bar-left">
          <h2 className="question-title">
            {reviewMode && <span className="review-badge">🔄 REVIEW</span>}
            {reinforceMode && <span className="reinforce-badge">🔥 REINFORCE</span>}
            {currentQuestion ? (currentQuestion.isLab ? `🧪 Lab ${currentQuestion.id}` : `📝 Q${currentQuestion.id}`) : '🎉 Complete'}
            {currentQuestion && results[currentQuestion.id] === 'correct' && <span className="result-badge correct">✓</span>}
            {currentQuestion && results[currentQuestion.id] === 'incorrect' && <span className="result-badge incorrect">✗</span>}
          </h2>
          <span className="progress-text">{stats.answered}/{stats.total}</span>
        </div>
        <div className="top-bar-right">
          <div className="search-wrapper">
            <input type="text" className="search-input" placeholder="Search..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} id="search-input" />
            {searchQuery && <span className="search-count">{filteredIndices?.length ?? stats.total}</span>}
          </div>
          <form onSubmit={handleJumpSubmit} className="jump-form">
            <input type="number" className="jump-input" placeholder="#" min={1} max={483}
              value={jumpValue} onChange={(e) => setJumpValue(e.target.value)} id="jump-input" />
            <button type="submit" className="btn btn-secondary btn-sm">Go</button>
          </form>
          <div className="nav-controls">
            <button className="btn btn-secondary" onClick={handlePrev} disabled={posInList <= 0 || !currentQuestion}>←</button>
            <button className="btn btn-primary" onClick={handleNext} disabled={posInList >= navList.length - 1 || !currentQuestion}>→</button>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsFullscreen(prev => !prev)}
            title="Toggle fullscreen (F)"
            id="fullscreen-btn"
          >⛶</button>
          <button className="btn btn-end-test" onClick={endTestWrapper}>🏁 End</button>
        </div>
      </header>
      <div className="content-scroll">
        {currentQuestion ? (
          <QuestionViewer
            question={currentQuestion} showAnswer={showAnswer}
            onShowAnswer={handleShowAnswer} onMarkResult={handleMarkResult}
            currentResult={results[currentQuestion.id]}
            failCount={failCounts[currentQuestion.id] || 0}
            selectedLetters={selectedLetters[currentQuestion.id] || []}
            onSelectLetter={(letters) => handleSelectLetter(currentQuestion.id, letters)}
          />
        ) : (
          <div className="reinforcement-complete-card glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
            <h2>🎉 Reinforcement Complete!</h2>
            <p className="text-muted" style={{ margin: '20px 0', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Excellent job! You have cleared all weak questions by answering them correctly 3 times consecutively.
            </p>
            <button className="btn btn-primary" onClick={backDashboardWrapper}>
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
      <footer className="bottom-nav">
        <button className="btn btn-secondary" onClick={handlePrev} disabled={posInList <= 0}>← Prev</button>
        <span className="bottom-nav-info">
          {reinforceMode && `🔥 ${questions.length} left`}
          {!reinforceMode && `${currentIndex + 1} / ${questions.length}`}
        </span>
        <button className="btn btn-primary" onClick={handleNext} disabled={posInList >= navList.length - 1}>Next →</button>
      </footer>
    </>
  );

  const resultsElement = (
    <div className="content-scroll">
      <ResultsDashboard questions={questions} results={results} stats={stats}
        onReviewIncorrect={reviewIncorrectWrapper} onJumpTo={jumpQuestionWrapper}
        onBackToDashboard={backDashboardWrapper} />
    </div>
  );

  return (
    <div className={`app-container${isFullscreen ? ' fullscreen-mode' : ''}`}>
      {!isFullscreen && (
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
      )}

      {isFullscreen && (
        <button
          className="fullscreen-exit-btn-fixed"
          onClick={() => setIsFullscreen(false)}
          title="Exit fullscreen (F)"
        >⛶ Exit</button>
      )}

      <Sidebar questions={questions} currentIndex={currentIndex} onSelect={jumpQuestionWrapper}
        results={results} stats={stats} session={session}
        currentView={pathCurrentView}
        reviewMode={reviewMode} onEnterReview={reviewIncorrectWrapper} onExitReview={exitReviewMode}
        profile={profile} onLogout={handleLogout} onEndSession={backDashboardWrapper}
        filteredIndices={filteredIndices} onEndTest={endTestWrapper}
        reinforceMode={reinforceMode} reinforceCorrectCounts={reinforceCorrectCounts}
        sidebarOpen={sidebarOpen}
      />

      <main className="main-area">
        <Routes>
          <Route path="/exam" element={examElement} />
          <Route path="/session/:sessionId" element={examElement} />
          <Route path="/results" element={resultsElement} />
          <Route path="/session/:sessionId/results" element={resultsElement} />
          <Route path="/history" element={
            <div className="content-scroll">
              <UserHistory user={user} questions={allQuestions} onJumpTo={(idx) => {
                const q = allQuestions[idx];
                if (q) { const localIdx = questions.findIndex(qq => qq.id === q.id); if (localIdx >= 0) jumpQuestionWrapper(localIdx); }
              }} />
            </div>
          } />
          <Route path="*" element={<Navigate to="/exam" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
