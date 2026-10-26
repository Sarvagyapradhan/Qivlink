import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import ShortenerSection from './components/ShortenerSection.jsx';
import QRStudioSection from './components/QRStudioSection.jsx';
import DeviceBeamSection from './components/DeviceBeamSection.jsx';
import VaultSection from './components/VaultSection.jsx';
import SupabaseModal from './components/SupabaseModal.jsx';
import RedirectHandler from './components/RedirectHandler.jsx';
import { getLocalDevice, registerDeviceInCloud } from './utils/deviceIdentity.js';
import { getActiveLinks } from './utils/linkManager.js';
import { getAllTransfers } from './utils/deviceTransferManager.js';

export default function App() {
  // Theme state
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('qivlink_theme') || 'light';
    } catch (e) {
      return 'light';
    }
  });

  // Navigation tab state
  const [activeTab, setActiveTab] = useState('shorten'); // 'shorten' | 'qr' | 'beam' | 'vault'

  // Supabase modal state
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Device & cloud synchronization state
  const [localDevice, setLocalDevice] = useState(getLocalDevice);
  const [links, setLinks] = useState([]);
  const [transfers, setTransfers] = useState([]);

  // Shared payload cross-navigation
  const [qrPrefill, setQrPrefill] = useState('');
  const [beamPrefill, setBeamPrefill] = useState({ content: '', title: '' });

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // URL Hash router check for privacy redirects
  const [redirectCode, setRedirectCode] = useState(null);

  const checkRedirectRoute = () => {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/r/')) {
      const code = hash.replace('#/r/', '').trim();
      if (code) {
        setRedirectCode(code);
        return;
      }
    }
    const params = new URLSearchParams(window.location.search);
    const qCode = params.get('r');
    if (qCode) {
      setRedirectCode(qCode);
      return;
    }
    setRedirectCode(null);
  };

  useEffect(() => {
    checkRedirectRoute();
    window.addEventListener('hashchange', checkRedirectRoute);
    return () => window.removeEventListener('hashchange', checkRedirectRoute);
  }, []);

  // Theme attribute management
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('qivlink_theme', theme);
    } catch (e) {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // Initial cloud sync
  const refreshAll = async () => {
    try {
      const [fetchedLinks, fetchedTransfers] = await Promise.all([
        getActiveLinks(),
        getAllTransfers(),
        registerDeviceInCloud(localDevice)
      ]);
      setLinks(fetchedLinks);
      setTransfers(fetchedTransfers);
    } catch (err) {
      console.warn('Initial cloud sync notice:', err);
    }
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, [localDevice]);

  // Handlers for cross-tab workflows
  const handleSelectForQr = (url) => {
    setQrPrefill(url);
    setActiveTab('qr');
  };

  const handleSelectForBeam = (content, title = '') => {
    setBeamPrefill({ content, title });
    setActiveTab('beam');
  };

  const handleLinkCreated = (newLink) => {
    setLinks(prev => [newLink, ...prev.filter(l => l.id !== newLink.id)]);
  };

  // If visiting a short link redirect route
  if (redirectCode) {
    return (
      <div className="app-viewport">
        <div className="gradient-ambient-container">
          <div className="gradient-orb orb-1" />
          <div className="gradient-orb orb-2" />
          <div className="gradient-orb orb-3" />
          <div className="gradient-orb orb-4" />
          <div className="mesh-subtle-overlay" />
        </div>
        <RedirectHandler
          shortCode={redirectCode}
          onBackToApp={() => {
            window.location.hash = '';
            setRedirectCode(null);
          }}
        />
      </div>
    );
  }

  // Count incoming transfers for this device
  const incomingCount = transfers.filter(
    t => t.targetToken && t.targetToken.toUpperCase() === localDevice.token.toUpperCase()
  ).length;

  return (
    <div className="app-viewport">
      {/* Dynamic Ambient Flowing Gradient Mesh */}
      <div className="gradient-ambient-container" aria-hidden="true">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="gradient-orb orb-4" />
        <div className="mesh-subtle-overlay" />
      </div>

      {/* Main Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        linksCount={links.length}
        transfersCount={incomingCount}
      />

      {/* Main Content Sections */}
      <main className="site-container" style={{ paddingBottom: '48px', flex: 1 }}>
        {activeTab === 'shorten' && (
          <ShortenerSection
            deviceToken={localDevice.token}
            onLinkCreated={handleLinkCreated}
            onSelectForQr={handleSelectForQr}
            onSelectForBeam={handleSelectForBeam}
            showToast={showToast}
          />
        )}

        {activeTab === 'qr' && (
          <QRStudioSection
            initialValue={qrPrefill}
            showToast={showToast}
          />
        )}

        {activeTab === 'beam' && (
          <DeviceBeamSection
            localDevice={localDevice}
            onDeviceUpdated={setLocalDevice}
            initialContent={beamPrefill.content}
            initialTitle={beamPrefill.title}
            showToast={showToast}
          />
        )}

        {activeTab === 'vault' && (
          <VaultSection
            links={links}
            onLinkDeleted={(updated) => setLinks(updated)}
            onRefresh={refreshAll}
            onSelectForQr={handleSelectForQr}
            onSelectForBeam={handleSelectForBeam}
            currentDeviceToken={localDevice.token}
            showToast={showToast}
          />
        )}
      </main>

      {/* Supabase Infrastructure Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        showToast={showToast}
      />

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast-item">
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="site-container app-footer">
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Qivlink</strong> — Fast, privacy-focused URL shortening & offline QR manager.
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span>Supabase Synced</span>
          <span>•</span>
          <span>Rolling 7-Day Auto-Purge</span>
          <span>•</span>
          <span>Zero Surveillance</span>
        </div>
      </footer>
    </div>
  );
}
