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
import AuthModal from './components/AuthModal.jsx';
import ApiKeyModal from './components/ApiKeyModal.jsx';
import LimitReachedModal from './components/LimitReachedModal.jsx';

import { getLocalDevice, registerDeviceInCloud } from './utils/deviceIdentity.js';
import { getActiveLinks } from './utils/linkManager.js';
import { getAllTransfers } from './utils/deviceTransferManager.js';
import { getActivePastes, getActiveFiles, supabase } from './supabase.js';
import { TOOL_NAMES } from './utils/rateLimiter.js';

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('qvlink_theme') || localStorage.getItem('qivlink_theme') || 'light';
    } catch (e) {
      return 'light';
    }
  });

  const [activeTab, setActiveTab] = useState('shorten'); // 'shorten' | 'qr' | 'paste' | 'files' | 'sharing' | 'history'
  const [localDevice, setLocalDevice] = useState(getLocalDevice);
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('qvlink_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin');
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitModalData, setLimitModalData] = useState({ toolName: '', hoursLeft: 24 });

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

  // Direct Google OAuth code receiver (when redirected back from Google)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const authCode = searchParams.get('code');
    if (authCode) {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || localStorage.getItem('qvlink_google_client_id');
      const clientSecret = localStorage.getItem('qvlink_google_client_secret');

      fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: window.location.origin
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          localStorage.setItem('qvlink_auth_user', JSON.stringify(data.user));
          setUser(data.user);
          showToast(`Welcome back, ${data.user.email}!`, 'success');
          const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
          window.history.replaceState(null, '', cleanUrl);
        } else if (data.error) {
          showToast(data.error || 'Google sign-in failed.', 'danger');
        }
      })
      .catch(err => {
        showToast('Google sign-in failed. Please try again.', 'danger');
      });
    }
  }, []);

  // Auth session initialization and listeners
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('qvlink_auth_user', JSON.stringify(session.user));
      }
      if (session && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('qvlink_auth_user', JSON.stringify(session.user));
      }
      if (session && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      localStorage.setItem('qvlink_theme', theme);
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
    }, 3200);
  };

  const refreshAll = async () => {
    try {
      const [fetchedLinks, fetchedTransfers, fetchedPastes, fetchedFiles] = await Promise.all([
        getActiveLinks(localDevice.token, user),
        getAllTransfers(),
        getActivePastes(localDevice.token, user),
        getActiveFiles(localDevice.token, user),
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
  }, [localDevice, user]);

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

  const handleOpenAuth = (mode = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('qvlink_auth_user');
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      showToast('Signed out successfully', 'info');
    } catch (e) {
      localStorage.removeItem('qvlink_auth_user');
      setUser(null);
      showToast('Signed out successfully', 'info');
    }
  };

  const handleLimitReached = (toolKey, hoursLeft) => {
    setLimitModalData({
      toolName: TOOL_NAMES[toolKey] || toolKey,
      hoursLeft: hoursLeft || 24
    });
    setLimitModalOpen(true);
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
      {/* Dynamic Animated Ambient Mesh Gradient Background */}
      <div className="gradient-ambient-container" aria-hidden="true">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="gradient-orb orb-4" />
      </div>

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        toggleTheme={toggleTheme}
        user={user}
        onOpenAuth={handleOpenAuth}
        onOpenApiKey={() => setApiKeyModalOpen(true)}
        onSignOut={handleSignOut}
        linksCount={links.length}
        transfersCount={incomingCount}
      />

      <main className="site-container" style={{ paddingBottom: '40px', flex: 1 }}>
        {activeTab === 'shorten' && (
          <ShortenerSection
            deviceToken={localDevice.token}
            currentUser={user}
            onLinkCreated={handleLinkCreated}
            onLimitReached={handleLimitReached}
            onSelectForQr={handleSelectForQr}
            onSelectForBeam={handleSelectForSharing}
            showToast={showToast}
          />
        )}

        {activeTab === 'qr' && (
          <QRStudioSection
            initialValue={qrPrefill}
            currentUser={user}
            onLimitReached={handleLimitReached}
            showToast={showToast}
          />
        )}

        {activeTab === 'paste' && (
          <PasteDocSection
            deviceToken={localDevice.token}
            currentUser={user}
            onDocCreated={(newDoc) => setPastes(prev => [newDoc, ...prev.filter(p => p.id !== newDoc.id)])}
            onLimitReached={handleLimitReached}
            showToast={showToast}
            onSelectForQr={handleSelectForQr}
          />
        )}

        {activeTab === 'files' && (
          <FileShareSection
            deviceToken={localDevice.token}
            currentUser={user}
            onFileUploaded={(newFile) => setFiles(prev => [newFile, ...prev.filter(f => f.id !== newFile.id)])}
            onFileDeleted={(id) => setFiles(prev => prev.filter(f => f.id !== id))}
            onLimitReached={handleLimitReached}
            showToast={showToast}
            onSelectForQr={handleSelectForQr}
          />
        )}

        {activeTab === 'sharing' && (
          <SharingSection
            localDevice={localDevice}
            currentUser={user}
            onDeviceUpdated={setLocalDevice}
            onLimitReached={handleLimitReached}
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
            currentUser={user}
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

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(authedUser) => {
          setUser(authedUser);
          showToast(`Welcome back, ${authedUser.email}! Unlimited plan active.`, 'success');
        }}
      />

      {/* Developer API Key Modal */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
        user={user}
        showToast={showToast}
      />

      {/* Guest Limit Reached Modal */}
      <LimitReachedModal
        isOpen={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        onOpenAuth={(mode) => handleOpenAuth(mode)}
        toolName={limitModalData.toolName}
        hoursLeft={limitModalData.hoursLeft}
      />

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast-item">
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <footer className="site-container app-footer">
        <div>
          <strong>Qvlink</strong> — Fast, privacy-focused link shortening, offline QR, and content sharing
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <span>7-Day Rolling Retention</span>
          <span>•</span>
          <span>Developer API Ready</span>
          <span>•</span>
          <span>Zero Tracking</span>
        </div>
      </footer>
    </div>
  );
}
