import { useState, useEffect, useMemo, useCallback } from 'react';
import './index.css';
import allQuestions from './data.json';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import SessionSetup from './components/SessionSetup';
import Sidebar from './components/Sidebar';
import QuestionViewer from './components/QuestionViewer';
import ResultsDashboard from './components/ResultsDashboard';
import UserHistory from './components/UserHistory';

// Extract correct answer from answerText
function extractCorrectAnswer(answerText) {
  if (!answerText) return [];
  const match = answerText.match(/Answer[.:]\s*([A-E,\s]+)/i);
  if (!match) return [];
  return match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-E]/i.test(c)).map(c => c.toUpperCase());
}

function App() {
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

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
  }

  // ========== AUTH ==========
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else { setProfile(null); setSession(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null); setResults({}); setCurrentIndex(0); setReinforceMode(false);
  };

  // ========== SESSION ==========
  const handleStartSession = async (sess) => {
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
  };

  // ========== REINFORCEMENT MODE ==========
  const handleStartReinforcement = async () => {
    // Load all answers to find questions with ≥2 fails
    const { data: allAnswers } = await supabase
      .from('answers').select('question_id, result').eq('user_id', user.id);
    if (!allAnswers) return;

    const failMap = {};
    allAnswers.forEach(a => {
      if (!failMap[a.question_id]) failMap[a.question_id] = { fails: 0, passes: 0 };
      if (a.result === 'incorrect') failMap[a.question_id].fails++;
      else failMap[a.question_id].passes++;
    });

    const weakIds = Object.entries(failMap)
      .filter(([, v]) => v.fails >= 1)
      .sort((a, b) => b[1].fails - a[1].fails)
      .map(([qId]) => parseInt(qId));

    if (weakIds.length === 0) {
      alert('🎉 No weak questions found! You\'re doing great!');
      return;
    }

    const filtered = allQuestions.filter(q => weakIds.includes(q.id));
    setQuestions(filtered);
    setCurrentIndex(0);
    setResults({});
    setSelectedLetters({});
    setReinforceMode(true);
    setReinforceCorrectCounts({});
    setShowAnswer(false);
    setCurrentView('exam');
    setSession({ id: 'reinforce', label: '🔥 Reinforcement', range_start: 0, range_end: 999 });
  };

  const handleEndSession = () => {
    setSession(null); setResults({}); setCurrentIndex(0); setReviewMode(false);
    setReinforceMode(false); setSelectedLetters({});
  };

  const handleEndTest = () => setCurrentView('results');
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

    // Save to Supabase (skip for reinforcement mode dummy session)
    if (session?.id && session.id !== 'reinforce') {
      await supabase.from('answers').insert({
        user_id: user.id, session_id: session.id,
        question_id: currentQuestion.id, result,
      });
      await supabase.from('study_sessions')
        .update({ last_question_id: currentQuestion.id, updated_at: new Date().toISOString() })
        .eq('id', session.id);
      setSession(prev => prev ? { ...prev, last_question_id: currentQuestion.id } : null);
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
    if (session.id !== 'reinforce') {
      // Prevent duplicates if user toggles mark multiple times
      await supabase.from('answers')
        .delete()
        .match({ session_id: session.id, question_id: currentQuestion.id });

      await supabase.from('answers').insert({
        user_id: user.id, session_id: session.id,
        question_id: currentQuestion.id, result,
      });
      if (result === 'incorrect') {
        setFailCounts(prev => ({ ...prev, [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1 }));
      }
      await supabase.from('study_sessions')
        .update({ last_question_id: currentQuestion.id, updated_at: new Date().toISOString() })
        .eq('id', session.id);
      setSession(prev => prev ? { ...prev, last_question_id: currentQuestion.id } : null);
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
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'n') handleNext();
      if (e.key === 'ArrowLeft' || e.key === 'p') handlePrev();
      if (e.key === 'r' && !showAnswer) handleShowAnswer();
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
  if (authLoading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!user) return <AuthScreen />;
  if (!session) return <SessionSetup user={user} profile={profile} onStartSession={handleStartSession}
    onLogout={handleLogout} onStartReinforcement={handleStartReinforcement} />;

  const navList = getNavList();
  const posInList = navList.indexOf(currentIndex);

  return (
    <div className="app-container">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>

      <Sidebar questions={questions} currentIndex={currentIndex} onSelect={jumpToQuestion}
        results={results} stats={stats} session={session}
        currentView={currentView} onViewChange={setCurrentView}
        reviewMode={reviewMode} onEnterReview={enterReviewMode} onExitReview={exitReviewMode}
        profile={profile} onLogout={handleLogout} onEndSession={handleEndSession}
        filteredIndices={filteredIndices} onEndTest={handleEndTest}
        reinforceMode={reinforceMode} reinforceCorrectCounts={reinforceCorrectCounts}
        sidebarOpen={sidebarOpen}
      />

      <main className="main-area">
        {currentView === 'exam' ? (
          <>
            <header className="top-bar">
              <div className="top-bar-left">
                <h2 className="question-title">
                  {reviewMode && <span className="review-badge">🔄 REVIEW</span>}
                  {reinforceMode && <span className="reinforce-badge">🔥 REINFORCE</span>}
                  {currentQuestion?.isLab ? `🧪 Lab ${currentQuestion.id}` : `📝 Q${currentQuestion?.id}`}
                  {results[currentQuestion?.id] === 'correct' && <span className="result-badge correct">✓</span>}
                  {results[currentQuestion?.id] === 'incorrect' && <span className="result-badge incorrect">✗</span>}
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
                  <button className="btn btn-secondary" onClick={handlePrev} disabled={posInList <= 0}>←</button>
                  <button className="btn btn-primary" onClick={handleNext} disabled={posInList >= navList.length - 1}>→</button>
                </div>
                <button className="btn btn-end-test" onClick={handleEndTest}>🏁 End</button>
              </div>
            </header>
            <div className="content-scroll">
              {currentQuestion && (
                <QuestionViewer
                  question={currentQuestion} showAnswer={showAnswer}
                  onShowAnswer={handleShowAnswer} onMarkResult={handleMarkResult}
                  currentResult={results[currentQuestion.id]}
                  failCount={failCounts[currentQuestion.id] || 0}
                  selectedLetters={selectedLetters[currentQuestion.id] || []}
                  onSelectLetter={(letters) => handleSelectLetter(currentQuestion.id, letters)}
                />
              )}
            </div>
            {/* Bottom Nav Bar */}
            <footer className="bottom-nav">
              <button className="btn btn-secondary" onClick={handlePrev} disabled={posInList <= 0}>← Prev</button>
              <span className="bottom-nav-info">
                {reinforceMode && `🔥 ${questions.length} left`}
                {!reinforceMode && `${currentIndex + 1} / ${questions.length}`}
              </span>
              <button className="btn btn-primary" onClick={handleNext} disabled={posInList >= navList.length - 1}>Next →</button>
            </footer>
          </>
        ) : currentView === 'results' ? (
          <div className="content-scroll">
            <ResultsDashboard questions={questions} results={results} stats={stats}
              onReviewIncorrect={enterReviewMode} onJumpTo={jumpToQuestion}
              onBackToDashboard={handleBackToDashboard} />
          </div>
        ) : currentView === 'history' ? (
          <div className="content-scroll">
            <UserHistory user={user} questions={allQuestions} onJumpTo={(idx) => {
              const q = allQuestions[idx];
              if (q) { const localIdx = questions.findIndex(qq => qq.id === q.id); if (localIdx >= 0) jumpToQuestion(localIdx); }
            }} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
