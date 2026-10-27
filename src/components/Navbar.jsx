import React, { useState, useRef, useEffect } from 'react';
import { 
  Link2, 
  QrCode, 
  FileText, 
  FolderUp, 
  Share2, 
  History, 
  Sun, 
  Moon, 
  User, 
  Key, 
  LogOut, 
  Sparkles, 
  ChevronDown 
} from 'lucide-react';

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
    <header className="app-navbar-container">
      {/* Top Header Row: Brand at Far Left, Auth & Theme at FAR RIGHT CORNER */}
      <div className="navbar-top-bar">
        <div 
          className="brand-wrapper" 
          onClick={() => setActiveTab('shorten')} 
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setActiveTab('shorten'); }}
          title="Qvlink Home"
        >
          <div className="brand-icon-box">
            <Link2 size={18} strokeWidth={2.4} />
          </div>
          <span className="brand-text">Qvlink</span>
        </div>

        {/* Far Right Corner: Theme Toggle & Sign In / User Profile */}
        <div className="navbar-actions-group">
          {/* Theme Toggle */}
          <button
            type="button"
            className="icon-btn theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* User Auth or Sign In/Sign Up */}
          {user ? (
            <div className="user-dropdown-container" ref={dropdownRef}>
              <button
                type="button"
                className="user-pill-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
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
            <div className="auth-buttons-group">
              <button
                type="button"
                className="btn btn-sm btn-ghost nav-signin-btn"
                onClick={() => onOpenAuth('signin')}
              >
                <User size={13} />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                className="btn btn-sm btn-primary nav-signup-btn"
                onClick={() => onOpenAuth('signup')}
              >
                <Sparkles size={13} />
                <span className="signup-label-full">Sign Up Free</span>
                <span className="signup-label-short">Sign Up</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Second Row: Dedicated Responsive Segmented Tool Tabs Bar */}
      <div className="navbar-tabs-container">
        <nav className="nav-tabs" aria-label="Tool Navigation">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'shorten' ? 'active' : ''}`}
            onClick={() => setActiveTab('shorten')}
          >
            <Link2 size={14} />
            <span>Shorten</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
            onClick={() => setActiveTab('qr')}
          >
            <QrCode size={14} />
            <span>QR Code</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
            onClick={() => setActiveTab('paste')}
          >
            <FileText size={14} />
            <span>Paste & Docs</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <FolderUp size={14} />
            <span>Files</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'sharing' ? 'active' : ''}`}
            onClick={() => setActiveTab('sharing')}
          >
            <Share2 size={14} />
            <span>Sharing</span>
            {transfersCount > 0 && (
              <span className="nav-tab-badge accent">
                {transfersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={14} />
            <span>History</span>
            {linksCount > 0 && (
              <span className="nav-tab-badge">
                {linksCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}

