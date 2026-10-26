import React from 'react';
import { Link2, QrCode, Radio, Database, Sun, Moon, ShieldCheck, HardDrive } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  theme,
  toggleTheme,
  onOpenSupabaseModal,
  linksCount = 0,
  transfersCount = 0
}) {
  return (
    <header className="app-navbar">
      <div className="brand-wrapper">
        <div className="brand-icon-box">
          <Link2 size={20} strokeWidth={2.5} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="brand-text">Qivlink</span>
          <span className="brand-tag">7D Rolling</span>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Main Navigation">
        <button
          className={`nav-tab-btn ${activeTab === 'shorten' ? 'active' : ''}`}
          onClick={() => setActiveTab('shorten')}
        >
          <Link2 size={15} />
          <span>Shorten</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          <QrCode size={15} />
          <span>QR Studio</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'beam' ? 'active' : ''}`}
          onClick={() => setActiveTab('beam')}
        >
          <Radio size={15} />
          <span>Device Beam</span>
          {transfersCount > 0 && (
            <span style={{
              fontSize: '0.7rem',
              background: 'var(--primary-accent)',
              color: '#ffffff',
              padding: '1px 6px',
              borderRadius: '9999px',
              marginLeft: '2px'
            }}>
              {transfersCount}
            </span>
          )}
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          <HardDrive size={15} />
          <span>Vault</span>
          {linksCount > 0 && (
            <span style={{
              fontSize: '0.7rem',
              background: 'var(--pill-bg)',
              color: 'var(--text-secondary)',
              padding: '1px 6px',
              borderRadius: '9999px',
              marginLeft: '2px',
              border: '1px solid var(--glass-border-subtle)'
            }}>
              {linksCount}
            </span>
          )}
        </button>
      </nav>

      <div className="nav-actions">
        <button
          className="btn btn-sm btn-secondary"
          onClick={onOpenSupabaseModal}
          title="Supabase Cloud Engine & SQL Schema"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Database size={14} color="#10b981" />
          <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Supabase</span>
          <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />
        </button>

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
