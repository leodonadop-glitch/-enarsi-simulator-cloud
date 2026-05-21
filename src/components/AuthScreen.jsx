import { useState } from 'react';
import { supabase } from '../lib/supabase';

function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!displayName.trim()) { setError('Please enter a display name'); setLoading(false); return; }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() } }
        });
        if (error) throw error;
        
        setSuccessMessage('¡Registro exitoso! Por favor, revisa tu correo electrónico para confirmar y activar tu cuenta antes de iniciar sesión.');
        // Clear fields on successful registration
        setDisplayName('');
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-glow"></div>
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <h1 className="auth-title">ENARSI</h1>
          <p className="auth-subtitle">300-410 Exam Simulator</p>
          <p className="auth-desc">483 Questions · Labs · Progress Tracking</p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(true); setError(''); setSuccessMessage(''); }}>
            Sign In
          </button>
          <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(false); setError(''); setSuccessMessage(''); }}>
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Leo"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
          {successMessage && <div className="auth-success">{successMessage}</div>}

          <button type="submit" className="btn btn-auth" disabled={loading}>
            {loading ? '⏳ Loading...' : isLogin ? '🚀 Sign In' : '✨ Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthScreen;
