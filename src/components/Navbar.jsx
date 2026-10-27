import React, { useState, useRef, useEffect } from 'react';
import { Link2, QrCode, FileText, Upload, Radio, Clock, Sun, Moon, User, Key, LogOut, Sparkles, ChevronDown } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  theme,
  toggleTheme,
  user,
  onOpenAuth,
  onOpenApiKey,
  onSignOut,
  linksCount = 0,
  transfersCount = 0
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  const shortEmail = user?.email ? (user.email.length > 18 ? user.email.slice(0, 16) + '...' : user.email) : '';

  return (
    <header className="app-navbar">
      <div className="navbar-top-row">
        <div className="brand-wrapper" onClick={() => setActiveTab('shorten')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon-box">
            <Link2 size={18} strokeWidth={2.5} />
          </div>
          <span className="brand-text">Qvlink</span>
        </div>

        <div className="navbar-actions-group">
          {/* User Auth / Account */}
          {user ? (
            <div className="user-dropdown-container" ref={dropdownRef}>
              <button
                type="button"
                className="user-pill-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-expanded={dropdownOpen}
              >
                <div className="user-avatar-circle">{userInitial}</div>
                <span className="user-email-text">{shortEmail}</span>
                <ChevronDown size={13} style={{ opacity: 0.7 }} />
              </button>

              {dropdownOpen && (
                <div className="user-dropdown-menu">
                  <div className="user-dropdown-header">
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                      {user.email}
                    </div>
                    <div className="unlimited-badge">
                      <Sparkles size={11} />
                      <span>Unlimited Plan</span>
                    </div>
                  </div>

                  <div className="user-dropdown-divider" />

                  <button
                    type="button"
                    className="user-dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenApiKey();
                    }}
                  >
                    <Key size={14} color="var(--primary-accent)" />
                    <span>Developer API Keys</span>
                  </button>

                  <button
                    type="button"
                    className="user-dropdown-item danger"
                    onClick={() => {
                      setDropdownOpen(false);
                      onSignOut();
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => onOpenAuth('signin')}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <User size={13} />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => onOpenAuth('signup')}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <Sparkles size={13} />
                <span>Sign Up Free</span>
              </button>
            </div>
          )}

          {/* Theme Toggle */}
          <div className="theme-toggle-wrap">
            <button
              className="icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Main Navigation">
        <button
          className={`nav-tab-btn ${activeTab === 'shorten' ? 'active' : ''}`}
          onClick={() => setActiveTab('shorten')}
        >
          <Link2 size={13} />
          <span>Shorten</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          <QrCode size={13} />
          <span>QR Code</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
          onClick={() => setActiveTab('paste')}
        >
          <FileText size={13} />
          <span>Paste & Docs</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <Upload size={13} />
          <span>Files</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'sharing' ? 'active' : ''}`}
          onClick={() => setActiveTab('sharing')}
        >
          <Radio size={13} />
          <span>Sharing</span>
          {transfersCount > 0 && (
            <span style={{
              fontSize: '0.65rem',
              background: 'var(--primary-accent)',
              color: '#ffffff',
              padding: '0 5px',
              borderRadius: '9999px',
              marginLeft: '2px'
            }}>
              {transfersCount}
            </span>
          )}
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Clock size={13} />
          <span>History</span>
          {linksCount > 0 && (
            <span style={{
              fontSize: '0.65rem',
              background: 'var(--border-default)',
              color: 'var(--text-secondary)',
              padding: '0 5px',
              borderRadius: '9999px',
              marginLeft: '2px'
            }}>
              {linksCount}
            </span>
          )}
        </button>
      </nav>
    </header>
  );
}
