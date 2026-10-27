import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Send, Copy, Check, Trash2, ExternalLink, ArrowDownLeft, QrCode, Sparkles, RefreshCw, FileText, Link as LinkIcon
} from 'lucide-react';
import {
  createQuickShare,
  receiveQuickShare,
  getLocalSentShares,
  removeLocalSentShare
} from '../utils/deviceTransferManager.js';
import { getRemainingTime } from '../supabase.js';
import { verifyToolUsage, consumeToolUsage } from '../utils/rateLimiter.js';

const RECEIVED_SHARES_KEY = 'qvlink_received_shares';

function getLocalReceivedShares() {
  try {
    const raw = localStorage.getItem(RECEIVED_SHARES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveLocalReceivedShare(item) {
  try {
    const list = getLocalReceivedShares();
    const updated = [item, ...list.filter(s => s.pin !== item.pin && s.id !== item.id)].slice(0, 30);
    localStorage.setItem(RECEIVED_SHARES_KEY, JSON.stringify(updated));
  } catch (e) {}
}

function removeLocalReceivedShare(pin) {
  try {
    const list = getLocalReceivedShares();
    const updated = list.filter(s => s.pin !== pin && s.id !== pin);
    localStorage.setItem(RECEIVED_SHARES_KEY, JSON.stringify(updated));
  } catch (e) {}
}

export default function SharingSection({
  localDevice,
  currentUser = null,
  onLimitReached,
  initialContent = '',
  initialPin = '',
  showToast
}) {
  const [activeTab, setActiveTab] = useState(initialPin ? 'receive' : 'send'); // 'send' | 'receive'
  const [content, setContent] = useState(initialContent || '');
  const [isSending, setIsSending] = useState(false);

  // Active created share (stays on screen permanently until dismissed)
  const [createdShare, setCreatedShare] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Receive state
  const [inputPin, setInputPin] = useState(initialPin || '');
  const [isReceiving, setIsReceiving] = useState(false);
  const [retrievedNote, setRetrievedNote] = useState(null);
  const [copiedNote, setCopiedNote] = useState(false);

  // History state
  const [mySentShares, setMySentShares] = useState([]);
  const [myReceivedShares, setMyReceivedShares] = useState([]);

  const currentHost = window.location.origin;

  const loadLocalLists = () => {
    setMySentShares(getLocalSentShares());
    setMyReceivedShares(getLocalReceivedShares());
  };

  useEffect(() => {
    loadLocalLists();
  }, []);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      setActiveTab('send');
    }
  }, [initialContent]);

  useEffect(() => {
    if (initialPin) {
      setInputPin(initialPin);
      setActiveTab('receive');
      handleRetrievePin(initialPin);
    }
  }, [initialPin]);

  // Generate QR code when a share is created
  useEffect(() => {
    if (createdShare && createdShare.pin) {
      const shareUrl = `${currentHost}/s/${createdShare.pin}`;
      QRCode.toDataURL(shareUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      })
      .then(url => setQrCodeDataUrl(url))
      .catch(console.error);
    }
  }, [createdShare]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      showToast('Enter some text, a link, or a note to share', 'warning');
      return;
    }

    // Rate limit check for guest users (1 per 24h)
    const limitCheck = await verifyToolUsage('sharing', currentUser);
    if (!limitCheck.allowed) {
      if (onLimitReached) {
        onLimitReached('sharing', limitCheck.hoursLeft);
      } else {
        showToast(`Free daily limit reached. Resets in ${limitCheck.hoursLeft}h. Sign in for unlimited!`, 'warning');
      }
      return;
    }

    setIsSending(true);
    try {
      const share = await createQuickShare({
        content: content.trim(),
        title: content.trim().startsWith('http') ? 'Shared Link' : 'Quick Note',
        deviceToken: localDevice.token,
        currentUser
      });

      await consumeToolUsage('sharing', currentUser);
      setCreatedShare(share);
      setContent('');
      loadLocalLists();
      showToast('Note ready to share! PIN: ' + share.pin, 'success');
    } catch (err) {
      showToast(err.message || 'Share failed. Please try again.', 'danger');
    } finally {
      setIsSending(false);
    }
  };

  const handleRetrievePin = async (pinToUse) => {
    const targetPin = (pinToUse || inputPin || '').trim().replace(/[\s-]/g, '');
    if (!targetPin) {
      showToast('Enter a 6-digit code to retrieve', 'warning');
      return;
    }

    setIsReceiving(true);
    try {
      const item = await receiveQuickShare(targetPin);
      setRetrievedNote(item);
      saveLocalReceivedShare(item);
      loadLocalLists();
      showToast('Note retrieved successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not find a note with this code.', 'danger');
    } finally {
      setIsReceiving(false);
    }
  };

  const handleCopyPin = (pin) => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    showToast('PIN copied to clipboard', 'success');
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleCopyShareLink = (pin) => {
    if (!pin) return;
    const url = `${currentHost}/s/${pin}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Share link copied to clipboard', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyNoteContent = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedNote(true);
    showToast('Note copied to clipboard', 'success');
    setTimeout(() => setCopiedNote(false), 2000);
  };

  const handleDeleteSent = (id) => {
    removeLocalSentShare(id);
    if (createdShare && createdShare.id === id) {
      setCreatedShare(null);
    }
    loadLocalLists();
    showToast('Share removed', 'info');
  };

  const handleDeleteReceived = (pin) => {
    removeLocalReceivedShare(pin);
    if (retrievedNote && retrievedNote.pin === pin) {
      setRetrievedNote(null);
    }
    loadLocalLists();
    showToast('Note cleared from history', 'info');
  };

  const formatPin = (pinStr) => {
    if (!pinStr) return '';
    const clean = String(pinStr).replace(/[\s-]/g, '');
    if (clean.length === 6) {
      return `${clean.slice(0, 3)} ${clean.slice(3)}`;
    }
    return clean;
  };

  return (
    <div className="sharing-container">
      <div className="clean-header">
        <h1 className="clean-title">Quick Share</h1>
        <p className="clean-desc">
          Effortlessly share notes, links, and snippets with anyone using an instant 6-digit code or QR code.
        </p>
      </div>

      {/* Segmented Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'send' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('send')}
          style={{ flex: 1, padding: '10px 16px' }}
        >
          <Send size={15} />
          <span>Share a Note</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'receive' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('receive')}
          style={{ flex: 1, padding: '10px 16px' }}
        >
          <ArrowDownLeft size={15} />
          <span>Receive with Code</span>
        </button>
      </div>

      {/* TAB 1: SEND / SHARE */}
      {activeTab === 'send' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Share Card (Persists indefinitely until user chooses to share another) */}
          {createdShare && (
            <div className="glass-panel" style={{
              border: '2px solid var(--primary-accent)',
              backgroundColor: 'rgba(99, 102, 241, 0.04)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="pulse-dot" style={{ width: '10px', height: '10px' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Active Share • Ready for Pickup
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCreatedShare(null)}
                >
                  Share Another Note
                </button>
              </div>

              {/* Huge PIN Display */}
              <div style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: 'var(--bg-elevated)',
                borderRadius: '12px',
                border: '1px solid var(--border-default)',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Your 6-Digit Share PIN
                </div>
                <div className="input-mono" style={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  letterSpacing: '4px',
                  color: 'var(--primary-accent)',
                  lineHeight: 1.1,
                  marginBottom: '16px'
                }}>
                  {formatPin(createdShare.pin)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleCopyPin(createdShare.pin)}
                  >
                    {copiedPin ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>{copiedPin ? 'PIN Copied!' : 'Copy PIN'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopyShareLink(createdShare.pin)}
                  >
                    {copiedLink ? <Check size={14} color="#10b981" /> : <ExternalLink size={14} />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                  </button>
                </div>
              </div>

              {/* QR Code and Direct URL row */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>Direct Link</div>
                  <div className="input-mono" style={{
                    fontSize: '0.84rem',
                    background: 'var(--bg-base)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    wordBreak: 'break-all',
                    color: 'var(--text-secondary)'
                  }}>
                    {currentHost}/s/{createdShare.pin}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                    Valid for 7 days. Anyone with this PIN or QR code can view this note.
                  </div>
                </div>

                {qrCodeDataUrl && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: '#ffffff', padding: '8px', borderRadius: '8px', display: 'inline-block' }}>
                      <img src={qrCodeDataUrl} alt="Scan QR Code" style={{ width: '110px', height: '110px', display: 'block' }} />
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      Scan to open on phone
                    </div>
                  </div>
                )}
              </div>

              {/* Preview of content */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                  Shared Content Preview
                </div>
                <div style={{
                  background: 'var(--bg-base)',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  fontSize: '0.86rem',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {createdShare.content}
                </div>
              </div>
            </div>
          )}

          {/* Share input form */}
          <div className="glass-panel">
            <form onSubmit={handleSend}>
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="share-note-text" className="form-label">Note, Link, or Text to Share</label>
                  <span className="form-hint">Instant 6-digit PIN</span>
                </div>
                <textarea
                  id="share-note-text"
                  className="textarea-custom input-mono"
                  style={{ minHeight: '140px', fontSize: '0.92rem' }}
                  placeholder="Type or paste anything to share: a note, wifi password, link, code snippet..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary" disabled={isSending}>
                  <Send size={15} />
                  <span>{isSending ? 'Generating PIN...' : 'Share Note & Get PIN'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Sent Shares list */}
          {mySentShares.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>
                  Active Shares Created on this Device ({mySentShares.length})
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mySentShares.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--bg-elevated)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-default)',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="input-mono" style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: 'var(--primary-accent)',
                        background: 'rgba(99, 102, 241, 0.1)',
                        padding: '4px 10px',
                        borderRadius: '6px'
                      }}>
                        {formatPin(item.pin)}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.title || 'Shared Note'}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                          {getRemainingTime(item.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopyPin(item.pin)}
                        title="Copy PIN"
                      >
                        <Copy size={13} />
                        <span>Copy PIN</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopyShareLink(item.pin)}
                        title="Copy Share URL"
                      >
                        <ExternalLink size={13} />
                        <span>Link</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-danger-outline btn-sm btn-icon-only"
                        onClick={() => handleDeleteSent(item.id)}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECEIVE / RETRIEVE */}
      {activeTab === 'receive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel">
            <form onSubmit={(e) => { e.preventDefault(); handleRetrievePin(); }}>
              <div className="form-group">
                <label htmlFor="receive-pin-input" className="form-label">
                  Enter 6-Digit Share PIN
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    id="receive-pin-input"
                    type="text"
                    className="input-text no-icon input-mono"
                    style={{
                      flex: 1,
                      minWidth: '160px',
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      letterSpacing: '2px',
                      textAlign: 'center'
                    }}
                    placeholder="e.g. 492 810"
                    maxLength={8}
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value)}
                    autoComplete="off"
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isReceiving}
                    style={{ padding: '0 24px' }}
                  >
                    <span>{isReceiving ? 'Retrieving...' : 'Get Note'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Retrieved note card */}
            {retrievedNote && (
              <div style={{
                marginTop: '20px',
                padding: '20px',
                borderRadius: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="retention-chip" style={{ fontSize: '0.76rem', color: 'var(--primary-accent)' }}>
                      PIN: {formatPin(retrievedNote.pin)}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                      {retrievedNote.type === 'link' ? 'Shared Link' : 'Shared Note'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleCopyNoteContent(retrievedNote.content)}
                    >
                      {copiedNote ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{copiedNote ? 'Copied!' : 'Copy Content'}</span>
                    </button>

                    {retrievedNote.type === 'link' && (
                      <a
                        href={retrievedNote.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <ExternalLink size={14} />
                        <span>Open Link</span>
                      </a>
                    )}
                  </div>
                </div>

                <div style={{
                  padding: '14px 16px',
                  background: 'var(--bg-base)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '350px',
                  overflowY: 'auto'
                }}>
                  {retrievedNote.type === 'link' ? (
                    <a
                      href={retrievedNote.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--primary-accent)', textDecoration: 'underline' }}
                    >
                      {retrievedNote.content}
                    </a>
                  ) : (
                    retrievedNote.content
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Received History */}
          {myReceivedShares.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>
                  Recently Retrieved Notes ({myReceivedShares.length})
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myReceivedShares.map((item) => (
                  <div
                    key={item.pin || item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--bg-elevated)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-default)',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="input-mono" style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--primary-accent)' }}>
                          {formatPin(item.pin)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                          {item.type === 'link' ? 'Link' : 'Note'}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '0.84rem',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '360px'
                      }}>
                        {item.content}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setRetrievedNote(item);
                          handleCopyNoteContent(item.content);
                        }}
                      >
                        <Copy size={13} />
                        <span>Copy</span>
                      </button>

                      {item.type === 'link' && (
                        <a
                          href={item.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}

                      <button
                        type="button"
                        className="btn btn-danger-outline btn-sm btn-icon-only"
                        onClick={() => handleDeleteReceived(item.pin)}
                        title="Remove from history"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
