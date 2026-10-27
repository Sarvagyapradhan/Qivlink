import React, { useState } from 'react';
import { X, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, authSignUpWithAutoConfirm, authSignInWithAutoConfirm } from '../supabase.js';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const result = await authSignUpWithAutoConfirm({
          email: email.trim(),
          password
        });

        if (result.session) {
          setSuccessMsg('Account created & verified! Unlimited plan active.');
          if (onAuthSuccess) onAuthSuccess(result.user);
          setTimeout(() => onClose(), 1200);
        } else if (result.requiresEmailCheck) {
          setSuccessMsg('Account registered! If confirmation is required, please check your inbox or sign in below.');
          setMode('signin');
        } else {
          setSuccessMsg('Welcome to Qvlink! Unlimited plan active.');
          if (onAuthSuccess) onAuthSuccess(result.user);
          setTimeout(() => onClose(), 1200);
        }
      } else {
        const result = await authSignInWithAutoConfirm({
          email: email.trim(),
          password
        });
        setSuccessMsg('Signed in successfully! Unlimited access active.');
        if (onAuthSuccess) onAuthSuccess(result.user);
        setTimeout(() => onClose(), 1000);
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already registered')) {
        setErrorMsg('This email is already registered. Please enter your password to Sign In.');
        setMode('signin');
      } else {
        setErrorMsg(msg || 'Authentication failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;

      if (data?.url) {
        // Pre-flight probe to verify provider is enabled before redirecting user
        try {
          const probe = await fetch(data.url);
          if (!probe.ok && probe.status === 400) {
            const body = await probe.text();
            if (body.includes('Unsupported provider') || body.includes('validation_failed')) {
              setErrorMsg('Google Sign-In is not enabled yet in your Supabase project (Authentication > Providers > Google). To enable it, turn on Google in Supabase dashboard. In the meantime, please sign in or register with Email & Password below!');
              setLoading(false);
              return;
            }
          }
        } catch (probeErr) {
          // If probe fails due to CORS, continue with redirect
        }

        // Provider is enabled - proceed to Google sign-in
        window.location.href = data.url;
      }
    } catch (err) {
      const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      if (msg.includes('Unsupported provider') || msg.includes('validation_failed')) {
        setErrorMsg('Google Sign-In is not enabled yet in this Supabase project (Authentication > Providers > Google). Please sign in or register with Email & Password below!');
      } else {
        setErrorMsg(msg || 'Google sign-in could not be initiated.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="brand-icon-box" style={{ width: '32px', height: '32px' }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                {mode === 'signup' ? 'Create Qvlink Account' : 'Welcome to Qvlink'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                {mode === 'signup' ? 'Unlock unlimited usage & developer API keys' : 'Sign in to access unlimited features'}
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tab-row">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => { setMode('signin'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            Create Account
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="auth-alert danger">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert success">
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          className="google-auth-btn"
          onClick={handleGoogleAuth}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="auth-divider">
          <span>or with email</span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Email Address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon-left" />
              <input
                type="email"
                className="input-text"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon-left" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-text"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="input-icon-right-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            <span>{loading ? 'Please wait...' : mode === 'signup' ? 'Create Unlimited Account' : 'Sign In'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          {mode === 'signup' ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                className="text-link"
                onClick={() => { setMode('signin'); setErrorMsg(''); }}
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              New to Qvlink?{' '}
              <button
                type="button"
                className="text-link"
                onClick={() => { setMode('signup'); setErrorMsg(''); }}
              >
                Create Account (Free)
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
