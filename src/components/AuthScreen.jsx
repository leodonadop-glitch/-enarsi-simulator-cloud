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

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
            try {
              await supabase.from('access_logs').insert({
                email: cleanEmail,
                action: 'email_unconfirmed',
                success: false,
                reason: 'Email not confirmed'
              });
            } catch (logErr) {
              console.error('Error logging unconfirmed email:', logErr);
            }
            throw new Error("Debes confirmar tu correo electrónico antes de iniciar sesión. Por favor, revisa tu bandeja de entrada.");
          }
          try {
            await supabase.from('access_logs').insert({
              email: cleanEmail,
              action: 'login_attempt',
              success: false,
              reason: error.message
            });
          } catch (logErr) {
            console.error('Error logging login failure:', logErr);
          }
          throw error;
        }

        if (data?.user) {
          try {
            await supabase.from('access_logs').insert({
              email: cleanEmail,
              action: 'login_attempt',
              success: true,
              user_id: data.user.id
            });
          } catch (logErr) {
            console.error('Error logging login success:', logErr);
          }
        }
      } else {
        if (!displayName.trim()) { setError('Please enter a display name'); setLoading(false); return; }

        // Whitelist Check before Signup
        const { data: whitelistData, error: whitelistError } = await supabase
          .from('whitelist_emails')
          .select('is_active')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (whitelistError) {
          throw new Error("Error al verificar la lista de acceso. Intenta de nuevo más tarde.");
        }

        if (!whitelistData || !whitelistData.is_active) {
          try {
            await supabase.from('access_logs').insert({
              email: cleanEmail,
              action: 'signup_attempt',
              success: false,
              reason: 'email_not_in_whitelist'
            });
          } catch (logErr) {
            console.error('Error logging whitelist rejection:', logErr);
          }
          throw new Error("Correo no autorizado. Contacta al administrador para obtener acceso.");
        }

        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: displayName.trim() } }
        });
        
        if (error) {
          try {
            await supabase.from('access_logs').insert({
              email: cleanEmail,
              action: 'signup_attempt',
              success: false,
              reason: error.message
            });
          } catch (logErr) {
            console.error('Error logging signup failure:', logErr);
          }
          throw error;
        }

        try {
          await supabase.from('access_logs').insert({
            email: cleanEmail,
            action: 'signup_attempt',
            success: true
          });
        } catch (logErr) {
          console.error('Error logging signup success:', logErr);
        }
        
        setSuccessMessage('¡Registro exitoso! Por favor, revisa tu correo electrónico para confirmar y activar tu cuenta antes de iniciar sesión.');
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
