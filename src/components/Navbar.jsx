import React from 'react';
import { Link2, QrCode, FileText, Upload, Radio, Clock, Sun, Moon } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  theme,
  toggleTheme,
  linksCount = 0,
  transfersCount = 0
}) {
  return (
    <header className="app-navbar">
      <div className="brand-wrapper">
        <div className="brand-icon-box">
          <Link2 size={19} strokeWidth={2.5} />
        </div>
        <span className="brand-text">Qivlink</span>
      </div>

      <nav className="nav-tabs" aria-label="Main Navigation">
        <button
          className={`nav-tab-btn ${activeTab === 'shorten' ? 'active' : ''}`}
          onClick={() => setActiveTab('shorten')}
        >
          <Link2 size={14} />
          <span>Shorten</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          <QrCode size={14} />
          <span>QR Code</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
          onClick={() => setActiveTab('paste')}
        >
          <FileText size={14} />
          <span>Paste & Docs</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <Upload size={14} />
          <span>Files</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'sharing' ? 'active' : ''}`}
          onClick={() => setActiveTab('sharing')}
        >
          <Radio size={14} />
          <span>Sharing</span>
          {transfersCount > 0 && (
            <span style={{
              fontSize: '0.68rem',
              background: 'var(--primary-accent)',
              color: '#ffffff',
              padding: '1px 5px',
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
          <Clock size={14} />
          <span>History</span>
          {linksCount > 0 && (
            <span style={{
              fontSize: '0.68rem',
              background: 'var(--border-default)',
              color: 'var(--text-secondary)',
              padding: '1px 5px',
              borderRadius: '9999px',
              marginLeft: '2px'
            }}>
              {linksCount}
            </span>
          )}
        </button>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}
