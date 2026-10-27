import React, { useState, useEffect } from 'react';
import {
  Send, Copy, Check, Trash2, ExternalLink, RefreshCw, Lock, ArrowDownLeft, Radio
} from 'lucide-react';
import {
  sendTransfer,
  getAllTransfers,
  redeemTransferByPickupCode,
  deleteTransfer
} from '../utils/deviceTransferManager.js';
import { fetchKnownDevices, saveLocalDevice } from '../utils/deviceIdentity.js';
import { getRemainingTime } from '../supabase.js';
import { verifyToolUsage, consumeToolUsage } from '../utils/rateLimiter.js';

export default function SharingSection({
  localDevice,
  currentUser = null,
  onDeviceUpdated,
  onLimitReached,
  initialContent = '',
  initialTitle = '',
  showToast
}) {
  const [activeTab, setActiveTab] = useState('send'); // 'send' | 'receive'
  const [knownDevices, setKnownDevices] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Send state
  const [content, setContent] = useState(initialContent || '');
  const [targetToken, setTargetToken] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Receive state
  const [pickupCode, setPickupCode] = useState('');
  const [redeemPasscode, setRedeemPasscode] = useState('');
  const [redeemedData, setRedeemedData] = useState(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (initialContent) setContent(initialContent);
  }, [initialContent]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [devs, txs] = await Promise.all([
        fetchKnownDevices(),
        getAllTransfers()
      ]);
      setKnownDevices(devs.filter(d => d.token !== localDevice.token));
      setTransfers(txs);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 12000);
    return () => clearInterval(timer);
  }, [localDevice.token]);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(localDevice.token);
    setCopiedToken(true);
    showToast('Device token copied', 'success');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      showToast('Enter some content or a link to share', 'warning');
      return;
    }

    // Rate limit check for guest users (1 per 24h)
    const limitCheck = await verifyToolUsage('sharing', currentUser);
    if (!limitCheck.allowed) {
      if (onLimitReached) {
        onLimitReached('sharing', limitCheck.hoursLeft);
      } else {
        showToast(`Free daily limit reached (1/1 per 24h). Resets in ${limitCheck.hoursLeft}h. Sign in for unlimited!`, 'warning');
      }
      return;
    }

    setIsSending(true);
    try {
      const item = await sendTransfer({
        targetToken,
        senderDevice: localDevice,
        contentType: content.trim().startsWith('http') ? 'link' : 'text',
        content,
        title: 'Shared Content',
        passcode,
        burnAfterRead: false
      });

      await consumeToolUsage('sharing', currentUser);
      showToast(
        targetToken
          ? `Sent directly to device ${targetToken}`
          : `Drop code created: ${item.pickupCode}`,
        'success'
      );

      setContent('');
      setPasscode('');
      setTargetToken('');
      loadData();
    } catch (err) {
      showToast(err.message || 'Share failed', 'danger');
    } finally {
      setIsSending(false);
    }
  };

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!pickupCode.trim()) {
      showToast('Enter a 6-digit drop code', 'warning');
      return;
    }

    setIsRedeeming(true);
    try {
      const item = await redeemTransferByPickupCode(pickupCode, redeemPasscode);
      setRedeemedData(item);
      showToast('Content retrieved', 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Could not find transfer', 'danger');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTransfer(id);
      showToast('Removed', 'success');
      loadData();
    } catch (e) {
      showToast('Delete failed', 'danger');
    }
  };

  const myInbox = transfers.filter(
    t => t.targetToken && t.targetToken.toUpperCase() === localDevice.token.toUpperCase()
  );

  return (
    <div className="sharing-container">
      <div className="clean-header">
        <h1 className="clean-title">Device Sharing</h1>
        <p className="clean-desc">
          Quickly beam links, text, or snippets between devices.
        </p>
      </div>

      {/* Your device ID banner */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Your Device ID</div>
            <div className="input-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-accent)' }}>
              {localDevice.token}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyToken}>
              {copiedToken ? <Check size={14} color="#059669" /> : <Copy size={14} />}
              <span>{copiedToken ? 'Copied' : 'Copy ID'}</span>
            </button>
            <button className="icon-btn" onClick={loadData} title="Refresh">
              <RefreshCw size={14} className={isLoading ? 'spin-anim' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'send' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('send')}
        >
          <Send size={14} />
          <span>Send</span>
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'receive' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('receive')}
        >
          <ArrowDownLeft size={14} />
          <span>Receive / Redeem ({myInbox.length})</span>
        </button>
      </div>

      {activeTab === 'send' && (
        <div className="glass-panel">
          <form onSubmit={handleSend}>
            <div className="form-group">
              <label htmlFor="share-content" className="form-label">Content or Link to Share</label>
              <textarea
                id="share-content"
                className="textarea-custom input-mono"
                style={{ minHeight: '120px' }}
                placeholder="Paste link, note, code, or message..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="target-id" className="form-label">Target Device ID (Optional)</label>
                  <span className="form-hint">Leave blank for drop code</span>
                </div>
                <input
                  id="target-id"
                  type="text"
                  className="input-text no-icon input-mono"
                  placeholder="e.g. QIV-XXXX-XXX"
                  value={targetToken}
                  onChange={(e) => setTargetToken(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="share-passcode" className="form-label">Passcode (Optional)</label>
                  <span className="form-hint">AES-256 encrypted</span>
                </div>
                <input
                  id="share-passcode"
                  type="password"
                  className="input-text no-icon"
                  placeholder="Optional PIN"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button type="submit" className="btn btn-primary" disabled={isSending}>
                <Send size={14} />
                <span>{isSending ? 'Sending...' : 'Send to Device'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'receive' && (
        <div className="glass-panel">
          {/* Pickup code input */}
          <form onSubmit={handleRedeem} style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-default)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>Redeem a Drop Code</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
              Enter the drop code given by the sender.
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="input-text no-icon input-mono"
                style={{ flex: 1, minWidth: '130px', textTransform: 'uppercase' }}
                placeholder="e.g. QIV-3942"
                value={pickupCode}
                onChange={(e) => setPickupCode(e.target.value)}
              />
              <input
                type="password"
                className="input-text no-icon"
                style={{ flex: 1, minWidth: '120px' }}
                placeholder="Passcode (if any)"
                value={redeemPasscode}
                onChange={(e) => setRedeemPasscode(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={isRedeeming} style={{ whiteSpace: 'nowrap' }}>
                <span>Get Content</span>
              </button>
            </div>

            {redeemedData && (
              <div className="result-box" style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-accent)', marginBottom: '4px' }}>
                  Retrieved Content
                </div>
                <div className="transfer-content-box" style={{ marginTop: '6px' }}>
                  {redeemedData.contentType === 'link' ? (
                    <a href={redeemedData.content} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-accent)' }}>
                      {redeemedData.content}
                    </a>
                  ) : (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                      {redeemedData.content}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </form>

          {/* Incoming Items for this device */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
              Received on this Device ({myInbox.length})
            </h3>

            {myInbox.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '0.86rem' }}>
                No active incoming shares for this device ID.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myInbox.map((item) => (
                  <div key={item.id} className="transfer-card-item">
                    <div className="transfer-header-row">
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                        From {item.senderToken}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-sm btn-secondary btn-icon-only"
                          onClick={() => {
                            navigator.clipboard.writeText(item.content);
                            showToast('Copied', 'success');
                          }}
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger-outline btn-icon-only"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="transfer-content-box">
                      {item.contentType === 'link' ? (
                        <a href={item.content} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-accent)' }}>
                          {item.content}
                        </a>
                      ) : (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.86rem' }}>
                          {item.content}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
