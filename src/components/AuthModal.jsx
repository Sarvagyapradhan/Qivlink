import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Settings, 
  ShieldCheck, 
  KeyRound,
  ExternalLink 
} from 'lucide-react';
import { authSignUpWithAutoConfirm, authSignInWithAutoConfirm } from '../supabase.js';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Direct Google OAuth configuration state
  const [showGoogleConfig, setShowGoogleConfig] = useState(false);
  const [customClientId, setCustomClientId] = useState(() => {
    try {
      return localStorage.getItem('qvlink_google_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    } catch (e) {
      return '';
    }
  });
  const [customClientSecret, setCustomClientSecret] = useState(() => {
    try {
      return localStorage.getItem('qvlink_google_client_secret') || '';
    } catch (e) {
      return '';
    }
  });

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setLoading(false);
      setShowGoogleConfig(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getEffectiveClientId = () => {
    return (customClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  };

  const getEffectiveClientSecret = () => {
    return (customClientSecret || '').trim();
  };

  // Direct token exchange with /api/auth/google backend
  const exchangeGoogleCode = async (code, redirectUri) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const clientId = getEffectiveClientId();
      const clientSecret = getEffectiveClientSecret();

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirect_uri: redirectUri || 'postmessage',
          client_id: clientId || undefined,
          client_secret: clientSecret || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Direct Google authentication failed');
      }

      // Persist authenticated user session directly in local device storage
      localStorage.setItem('qvlink_auth_user', JSON.stringify(data.user));
      setSuccessMsg(`Welcome, ${data.user.email}! Direct Google sign-in verified.`);
      
      if (onAuthSuccess) {
        onAuthSuccess(data.user);
      }
      setTimeout(() => onClose(), 1100);
    } catch (err) {
      setErrorMsg(err.message || 'Direct Google authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Direct Google OAuth: Completely bypasses Supabase mediator
  const handleGoogleAuth = () => {
    setErrorMsg('');
    const clientId = getEffectiveClientId();

    if (!clientId) {
      setShowGoogleConfig(true);
      setErrorMsg('Please configure your Google OAuth Client ID below to connect directly.');
      return;
    }

    setLoading(true);

    // Flow A: Google Identity Services popup code client
    if (window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: 'openid email profile',
          ux_mode: 'popup',
          callback: async (response) => {
            if (response.error) {
              setLoading(false);
              setErrorMsg(`Google authorization error: ${response.error_description || response.error}`);
              return;
            }
            if (response.code) {
              await exchangeGoogleCode(response.code, 'postmessage');
            } else {
              setLoading(false);
            }
          },
          error_callback: (err) => {
            console.warn('GIS error, falling back to direct redirect:', err);
            triggerDirectRedirect(clientId);
          }
        });
        client.requestCode();
        return;
      } catch (gisErr) {
        console.warn('GIS initCodeClient failed, falling back to direct redirect:', gisErr);
      }
    }

    // Flow B: Direct OAuth 2.0 redirect straight to Google
    triggerDirectRedirect(clientId);
  };

  const triggerDirectRedirect = (clientId) => {
    try {
      const redirectUri = window.location.origin;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account'
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } catch (err) {
      setLoading(false);
      setErrorMsg(`Failed to launch Google authentication: ${err.message}`);
    }
  };

  const handleSaveGoogleConfig = (e) => {
    e.preventDefault();
    try {
      const cleanId = customClientId.trim();
      const cleanSecret = customClientSecret.trim();
      
      if (!cleanId) {
        setErrorMsg('Please enter a valid Google Client ID.');
        return;
      }

      localStorage.setItem('qvlink_google_client_id', cleanId);
      if (cleanSecret) {
        localStorage.setItem('qvlink_google_client_secret', cleanSecret);
      }

      setShowGoogleConfig(false);
      setErrorMsg('');
      setSuccessMsg('Google OAuth configuration saved! Initiating direct sign-in...');
      setTimeout(() => handleGoogleAuth(), 400);
    } catch (err) {
      setErrorMsg('Failed to save configuration: ' + err.message);
    }
  };

  // Standard Email Authentication with auto-confirm
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
          localStorage.setItem('qvlink_auth_user', JSON.stringify(result.user));
          setSuccessMsg('Account created & verified! Unlimited plan active.');
          if (onAuthSuccess) onAuthSuccess(result.user);
          setTimeout(() => onClose(), 1200);
        } else if (result.requiresEmailCheck) {
          setSuccessMsg('Account registered! If confirmation is required, please check your inbox or sign in below.');
          setMode('signin');
        } else {
          localStorage.setItem('qvlink_auth_user', JSON.stringify(result.user));
          setSuccessMsg('Welcome to Qvlink! Unlimited plan active.');
          if (onAuthSuccess) onAuthSuccess(result.user);
          setTimeout(() => onClose(), 1200);
        }
      } else {
        const result = await authSignInWithAutoConfirm({
          email: email.trim(),
          password
        });
        localStorage.setItem('qvlink_auth_user', JSON.stringify(result.user));
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
            <span style={{ wordBreak: 'break-word' }}>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert success">
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Direct Google OAuth Section */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="google-auth-btn"
            onClick={handleGoogleAuth}
            disabled={loading}
            style={{ flex: 1 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>{loading ? 'Connecting directly...' : 'Continue with Google (Direct)'}</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowGoogleConfig(!showGoogleConfig)}
            title="Configure Direct Google OAuth Client ID & Secret"
            style={{ 
              width: '42px', 
              height: '42px', 
              border: '1.5px solid var(--border-default)', 
              borderRadius: 'var(--radius-md)',
              background: showGoogleConfig ? 'var(--accent-soft)' : 'var(--bg-surface)'
            }}
          >
            <Settings size={17} color={showGoogleConfig ? 'var(--primary-accent)' : 'var(--text-tertiary)'} />
          </button>
        </div>

        {/* Direct Google Configuration Accordion */}
        {showGoogleConfig && (
          <form onSubmit={handleSaveGoogleConfig} style={{
            marginTop: '12px',
            padding: '14px',
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            fontSize: '0.82rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 600 }}>
              <ShieldCheck size={16} color="var(--primary-accent)" />
              <span>Direct Google OAuth Credentials</span>
            </div>
            <p style={{ margin: '0 0 10px', color: 'var(--text-tertiary)', fontSize: '0.76rem', lineHeight: 1.4 }}>
              Zero intermediary. Google's prompt shows <strong>qvlink.vercel.app</strong> (or localhost) directly.
            </p>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label" style={{ fontSize: '0.74rem' }}>Google Client ID</label>
              <div className="input-wrapper">
                <KeyRound size={14} className="input-icon-left" />
                <input
                  type="text"
                  className="input-text"
                  style={{ fontSize: '0.8rem', padding: '8px 10px 8px 30px' }}
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontSize: '0.74rem' }}>Google Client Secret (Optional for direct exchange)</label>
              <div className="input-wrapper">
                <Lock size={14} className="input-icon-left" />
                <input
                  type="password"
                  className="input-text"
                  style={{ fontSize: '0.8rem', padding: '8px 10px 8px 30px' }}
                  placeholder="GOCSPX-..."
                  value={customClientSecret}
                  onChange={(e) => setCustomClientSecret(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>Save & Sign In Directly</span>
            </button>
          </form>
        )}

        <div className="auth-divider">
          <span>or continue with email</span>
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
