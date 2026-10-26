import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import ShortenerSection from './components/ShortenerSection.jsx';
import QRStudioSection from './components/QRStudioSection.jsx';
import PasteDocSection from './components/PasteDocSection.jsx';
import FileShareSection from './components/FileShareSection.jsx';
import SharingSection from './components/SharingSection.jsx';
import HistorySection from './components/HistorySection.jsx';
import RedirectHandler from './components/RedirectHandler.jsx';
import PasteViewer from './components/PasteViewer.jsx';

import { getLocalDevice, registerDeviceInCloud } from './utils/deviceIdentity.js';
import { getActiveLinks } from './utils/linkManager.js';
import { getAllTransfers } from './utils/deviceTransferManager.js';
import { getActivePastes, getActiveFiles } from './supabase.js';

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('qivlink_theme') || 'light';
    } catch (e) {
      return 'light';
    }
  });

  const [activeTab, setActiveTab] = useState('shorten'); // 'shorten' | 'qr' | 'paste' | 'files' | 'sharing' | 'history'
  const [localDevice, setLocalDevice] = useState(getLocalDevice);
  const [links, setLinks] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [pastes, setPastes] = useState([]);
  const [files, setFiles] = useState([]);

  const [qrPrefill, setQrPrefill] = useState('');
  const [sharingPrefill, setSharingPrefill] = useState({ content: '', title: '' });
  const [toasts, setToasts] = useState([]);

  // Routing states
  const [redirectCode, setRedirectCode] = useState(null);
  const [pasteDocCode, setPasteDocCode] = useState(null);

  const checkRoute = () => {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/r/')) {
      const code = hash.replace('#/r/', '').trim();
      if (code) {
        setRedirectCode(code);
        setPasteDocCode(null);
        return;
      }
    }
    if (hash.startsWith('#/p/')) {
      const pCode = hash.replace('#/p/', '').trim();
      if (pCode) {
        setPasteDocCode(pCode);
        setRedirectCode(null);
        return;
      }
    }
    setRedirectCode(null);
    setPasteDocCode(null);
  };

  useEffect(() => {
    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
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
      const [fetchedLinks, fetchedTransfers, fetchedPastes, fetchedFiles] = await Promise.all([
        getActiveLinks(localDevice.token),
        getAllTransfers(),
        getActivePastes(localDevice.token),
        getActiveFiles(localDevice.token),
        registerDeviceInCloud(localDevice)
      ]);
      setLinks(fetchedLinks);
      setTransfers(fetchedTransfers);
      setPastes(fetchedPastes);
      setFiles(fetchedFiles);
    } catch (err) {
      console.warn('Sync notice:', err);
    }
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 14000);
    return () => clearInterval(interval);
  }, [localDevice]);

  const handleSelectForQr = (url) => {
    setQrPrefill(url);
    setActiveTab('qr');
  };

  const handleSelectForSharing = (content, title = '') => {
    setSharingPrefill({ content, title });
    setActiveTab('sharing');
  };

  const handleLinkCreated = (newLink) => {
    setLinks(prev => [newLink, ...prev.filter(l => l.id !== newLink.id)]);
  };

  // Route 1: Short link redirect
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

  // Route 2: Long-form paste viewer
  if (pasteDocCode) {
    return (
      <div className="app-viewport">
        <PasteViewer
          code={pasteDocCode}
          onBackToApp={() => {
            window.location.hash = '';
            setPasteDocCode(null);
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
      <div className="gradient-ambient-container" aria-hidden="true">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
      </div>

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        toggleTheme={toggleTheme}
        linksCount={links.length}
        transfersCount={incomingCount}
      />

      <main className="site-container" style={{ paddingBottom: '36px', flex: 1 }}>
        {activeTab === 'shorten' && (
          <ShortenerSection
            deviceToken={localDevice.token}
            onLinkCreated={handleLinkCreated}
            onSelectForQr={handleSelectForQr}
            onSelectForBeam={handleSelectForSharing}
            showToast={showToast}
          />
        )}

        {activeTab === 'qr' && (
          <QRStudioSection
            initialValue={qrPrefill}
            showToast={showToast}
          />
        )}

        {activeTab === 'paste' && (
          <PasteDocSection
            deviceToken={localDevice.token}
            onDocCreated={(newDoc) => setPastes(prev => [newDoc, ...prev.filter(p => p.id !== newDoc.id)])}
            showToast={showToast}
            onSelectForQr={handleSelectForQr}
          />
        )}

        {activeTab === 'files' && (
          <FileShareSection
            deviceToken={localDevice.token}
            onFileUploaded={(newFile) => setFiles(prev => [newFile, ...prev.filter(f => f.id !== newFile.id)])}
            onFileDeleted={(id) => setFiles(prev => prev.filter(f => f.id !== id))}
            showToast={showToast}
            onSelectForQr={handleSelectForQr}
          />
        )}

        {activeTab === 'sharing' && (
          <SharingSection
            localDevice={localDevice}
            onDeviceUpdated={setLocalDevice}
            initialContent={sharingPrefill.content}
            initialTitle={sharingPrefill.title}
            showToast={showToast}
          />
        )}

        {activeTab === 'history' && (
          <HistorySection
            links={links}
            pastes={pastes}
            files={files}
            onLinkDeleted={(id) => setLinks(prev => prev.filter(l => l.id !== id))}
            onPasteDeleted={(id) => setPastes(prev => prev.filter(p => p.id !== id))}
            onFileDeleted={(id) => setFiles(prev => prev.filter(f => f.id !== id))}
            onRefresh={refreshAll}
            onSelectForQr={handleSelectForQr}
            currentDeviceToken={localDevice.token}
            showToast={showToast}
          />
        )}
      </main>

      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast-item">
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <footer className="site-container app-footer">
        <div>
          <strong>Qivlink</strong> — Fast, privacy-focused link shortening, offline QR, and content sharing
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <span>7-Day Rolling Retention</span>
          <span>•</span>
          <span>Zero Tracking</span>
        </div>
      </footer>
    </div>
  );
}
