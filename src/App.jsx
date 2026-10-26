import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import ShortenerSection from './components/ShortenerSection.jsx';
import QRStudioSection from './components/QRStudioSection.jsx';
import DeviceBeamSection from './components/DeviceBeamSection.jsx';
import VaultSection from './components/VaultSection.jsx';
import RedirectHandler from './components/RedirectHandler.jsx';
import { getLocalDevice, registerDeviceInCloud } from './utils/deviceIdentity.js';
import { getActiveLinks } from './utils/linkManager.js';
import { getAllTransfers } from './utils/deviceTransferManager.js';

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('qivlink_theme') || 'light';
    } catch (e) {
      return 'light';
    }
  });

  const [activeTab, setActiveTab] = useState('shorten');
  const [localDevice, setLocalDevice] = useState(getLocalDevice);
  const [links, setLinks] = useState([]);
  const [transfers, setTransfers] = useState([]);

  const [qrPrefill, setQrPrefill] = useState('');
  const [beamPrefill, setBeamPrefill] = useState({ content: '', title: '' });
  const [toasts, setToasts] = useState([]);
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
    }, 3000);
  };

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
      console.warn('Sync notice:', err);
    }
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 12000);
    return () => clearInterval(interval);
  }, [localDevice]);

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

  if (redirectCode) {
    return (
      <div className="app-viewport">
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

  const incomingCount = transfers.filter(
    t => t.targetToken && t.targetToken.toUpperCase() === localDevice.token.toUpperCase()
  ).length;

  return (
    <div className="app-viewport">
      {/* Subtle Ambient Background */}
      <div className="gradient-ambient-container" aria-hidden="true">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
      </div>

      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        toggleTheme={toggleTheme}
        linksCount={links.length}
        transfersCount={incomingCount}
      />

      {/* Content */}
      <main className="site-container" style={{ paddingBottom: '36px', flex: 1 }}>
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
          <strong>Qivlink</strong> — Privacy URL Shortener & Offline QR Studio
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <span>7-Day Rolling Retention</span>
          <span>•</span>
          <span>Zero Telemetry</span>
        </div>
      </footer>
    </div>
  );
}
