import React, { useState, useEffect } from 'react';
import {
  Radio, Send, Key, Lock, Eye, EyeOff, Copy, Check, Trash2,
  ExternalLink, Laptop, Smartphone, Clock, RefreshCw, QrCode, ArrowDownLeft
} from 'lucide-react';
import {
  sendTransfer,
  getAllTransfers,
  redeemTransferByPickupCode,
  deleteTransfer
} from '../utils/deviceTransferManager.js';
import { fetchKnownDevices, saveLocalDevice } from '../utils/deviceIdentity.js';
import { getRemainingTime } from '../supabase.js';

export default function DeviceBeamSection({
  localDevice,
  onDeviceUpdated,
  initialContent = '',
  initialTitle = '',
  showToast
}) {
  const [activeSubTab, setActiveSubTab] = useState('send'); // 'send' | 'pickup' | 'inbox'
  const [knownDevices, setKnownDevices] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Send form states
  const [targetToken, setTargetToken] = useState('');
  const [contentType, setContentType] = useState('link');
  const [content, setContent] = useState(initialContent || '');
  const [title, setTitle] = useState(initialTitle || '');
  const [passcode, setPasscode] = useState('');
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Pickup redeem states
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [redeemPasscode, setRedeemPasscode] = useState('');
  const [redeemedItem, setRedeemedItem] = useState(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Device edit state
  const [isEditingDeviceName, setIsEditingDeviceName] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState(localDevice.name || 'My Device');

  // Copied helper
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
    }
    if (initialTitle) {
      setTitle(initialTitle);
    }
  }, [initialContent, initialTitle]);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [devList, txList] = await Promise.all([
        fetchKnownDevices(),
        getAllTransfers()
      ]);
      setKnownDevices(devList.filter(d => d.token !== localDevice.token));
      setTransfers(txList);
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 12000); // Polling for new incoming beams
    return () => clearInterval(interval);
  }, [localDevice.token]);

  const handleSaveDeviceName = () => {
    const updated = { ...localDevice, name: deviceNameInput.trim() || 'My Device' };
    saveLocalDevice(updated);
    if (onDeviceUpdated) onDeviceUpdated(updated);
    setIsEditingDeviceName(false);
    showToast('Device identifier updated', 'success');
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(localDevice.token);
    setCopiedToken(true);
    showToast('Device token copied', 'success');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      showToast('Please enter the content to share', 'warning');
      return;
    }

    setIsSending(true);
    try {
      const item = await sendTransfer({
        targetToken,
        senderDevice: localDevice,
        contentType,
        content,
        title,
        passcode,
        burnAfterRead
      });

      showToast(
        targetToken
          ? `Beam transmitted to device ${targetToken}`
          : `Quick drop generated: Code ${item.pickupCode}`,
        'success'
      );

      setContent('');
      setTitle('');
      setPasscode('');
      setBurnAfterRead(false);
      setTargetToken('');
      refreshData();
    } catch (err) {
      showToast(err.message || 'Failed to beam content', 'danger');
    } finally {
      setIsSending(false);
    }
  };

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!pickupCodeInput.trim()) {
      showToast('Enter a pickup code', 'warning');
      return;
    }

    setIsRedeeming(true);
    try {
      const found = await redeemTransferByPickupCode(pickupCodeInput, redeemPasscode);
      setRedeemedItem(found);
      showToast('Transfer received successfully', 'success');
      refreshData();
    } catch (err) {
      showToast(err.message || 'Could not redeem code', 'danger');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleDeleteTransfer = async (id) => {
    try {
      await deleteTransfer(id);
      showToast('Item deleted', 'success');
      refreshData();
    } catch (err) {
      showToast('Failed to delete item', 'danger');
    }
  };

  // Filter transfers aimed specifically at this device
  const inboxForMe = transfers.filter(
    t => t.targetToken && t.targetToken.toUpperCase() === localDevice.token.toUpperCase()
  );

  return (
    <div className="device-beam-wrapper">
      {/* Current Device Identity Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="panel-icon-badge" style={{ background: 'var(--accent-soft)', color: 'var(--primary-accent)' }}>
              <Laptop size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isEditingDeviceName ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      className="input-text no-icon"
                      style={{ padding: '4px 8px', fontSize: '0.86rem' }}
                      value={deviceNameInput}
                      onChange={(e) => setDeviceNameInput(e.target.value)}
                    />
                    <button className="btn btn-sm btn-primary" onClick={handleSaveDeviceName}>Save</button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontWeight: 600, fontSize: '0.98rem' }}>{localDevice.name}</span>
                    <button
                      onClick={() => setIsEditingDeviceName(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.74rem', textDecoration: 'underline' }}
                    >
                      Rename
                    </button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <span className="device-id-code">{localDevice.token}</span>
                <span className="device-pin-chip">PIN: {localDevice.pin}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyToken}
            >
              {copiedToken ? <Check size={14} color="#059669" /> : <Copy size={14} />}
              <span>{copiedToken ? 'Token Copied' : 'Copy Device Token'}</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={refreshData}
              title="Refresh device network & incoming queue"
            >
              <RefreshCw size={15} className={isLoading ? 'spin-anim' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Mode Sub-nav */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`btn btn-sm ${activeSubTab === 'send' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('send')}
        >
          <Send size={14} />
          <span>Beam to Device</span>
        </button>

        <button
          className={`btn btn-sm ${activeSubTab === 'pickup' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('pickup')}
        >
          <ArrowDownLeft size={14} />
          <span>Redeem Drop Code</span>
        </button>

        <button
          className={`btn btn-sm ${activeSubTab === 'inbox' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('inbox')}
        >
          <Radio size={14} />
          <span>Incoming Transmissions ({inboxForMe.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: SEND BEAM */}
      {activeSubTab === 'send' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Beam Content to Selected Device</h3>
              <p className="panel-description">
                Direct cross-device sharing with 7-day retention and zero permanent storage.
              </p>
            </div>
          </div>

          <form onSubmit={handleSend}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="target-device-select" className="form-label">Target Device Token</label>
                  <span className="form-hint">Leave blank for open Drop Code</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="target-device-select"
                    type="text"
                    className="input-text no-icon input-mono"
                    placeholder="e.g. QIV-8732-B8"
                    value={targetToken}
                    onChange={(e) => setTargetToken(e.target.value)}
                  />
                  {knownDevices.length > 0 && (
                    <select
                      className="input-text no-icon"
                      style={{ maxWidth: '140px', padding: '8px' }}
                      onChange={(e) => {
                        if (e.target.value) setTargetToken(e.target.value);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Recent devices</option>
                      {knownDevices.map(d => (
                        <option key={d.token} value={d.token}>{d.name} ({d.token})</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payload Type</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['link', 'text', 'note'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`btn btn-sm ${contentType === type ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, textTransform: 'capitalize' }}
                      onClick={() => setContentType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="beam-title" className="form-label">Title / Reference (Optional)</label>
              <input
                id="beam-title"
                type="text"
                className="input-text no-icon"
                placeholder="e.g. API credentials or reading link"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="beam-content" className="form-label">Content Payload</label>
              <textarea
                id="beam-content"
                className="textarea-custom input-mono"
                placeholder={contentType === 'link' ? 'https://...' : 'Paste text snippet, code block, or sensitive note...'}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="beam-passcode" className="form-label">Optional Passcode / PIN</label>
                  <span className="form-hint">Recipient must enter this</span>
                </div>
                <div className="input-wrapper">
                  <Lock size={16} className="input-icon-left" />
                  <input
                    id="beam-passcode"
                    type="password"
                    className="input-text"
                    placeholder="e.g. 4-digit code"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                  />
                </div>
              </div>

              <div className="toggle-row" style={{ marginTop: '22px' }}>
                <div className="toggle-info">
                  <span className="toggle-title">Burn After First Read</span>
                  <span className="toggle-desc">Deletes immediately after recipient views</span>
                </div>
                <label className="switch-pill">
                  <input
                    type="checkbox"
                    checked={burnAfterRead}
                    onChange={(e) => setBurnAfterRead(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSending}
              >
                <Send size={15} />
                <span>{isSending ? 'Transmitting...' : 'Send Transmission'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-TAB 2: REDEEM DROP CODE */}
      {activeSubTab === 'pickup' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Redeem Quick Drop Code</h3>
              <p className="panel-description">
                Enter the 6-character code or drop ID shared from another device.
              </p>
            </div>
          </div>

          <form onSubmit={handleRedeem} style={{ maxWidth: '480px' }}>
            <div className="form-group">
              <label htmlFor="pickup-code-input" className="form-label">Drop Code</label>
              <input
                id="pickup-code-input"
                type="text"
                className="input-text no-icon input-mono"
                style={{ fontSize: '1.2rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                placeholder="e.g. QIV-4821"
                value={pickupCodeInput}
                onChange={(e) => setPickupCodeInput(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="redeem-passcode-input" className="form-label">Passcode (If sender set one)</label>
              <input
                id="redeem-passcode-input"
                type="password"
                className="input-text no-icon"
                placeholder="Passcode..."
                value={redeemPasscode}
                onChange={(e) => setRedeemPasscode(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isRedeeming}>
              {isRedeeming ? 'Validating...' : 'Claim & View Content'}
            </button>
          </form>

          {redeemedItem && (
            <div className="result-box" style={{ marginTop: '24px' }}>
              <div className="result-label">Decrypted Payload</div>
              <h4 style={{ margin: '8px 0', fontSize: '1.05rem' }}>{redeemedItem.title}</h4>
              <div className="transfer-content-box">
                {redeemedItem.contentType === 'link' ? (
                  <a
                    href={redeemedItem.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary-accent)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>{redeemedItem.content}</span>
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                    {redeemedItem.content}
                  </pre>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                <span>Sent from: {redeemedItem.senderName} ({redeemedItem.senderToken})</span>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(redeemedItem.content);
                    showToast('Payload copied to clipboard', 'success');
                  }}
                >
                  <Copy size={13} />
                  <span>Copy Payload</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: INBOX FOR THIS DEVICE */}
      {activeSubTab === 'inbox' && (
        <div className="glass-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Incoming Transmissions</h3>
              <p className="panel-description">
                Items explicitly routed to this device token ({localDevice.token}).
              </p>
            </div>
          </div>

          {inboxForMe.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-tertiary)' }}>
              <Radio size={32} style={{ opacity: 0.35, marginBottom: '10px' }} />
              <p>No active incoming beams for this device yet.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Share your device token <strong style={{ color: 'var(--text-primary)' }}>{localDevice.token}</strong> with other devices to receive items here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
              {inboxForMe.map((item) => (
                <div key={item.id} className="transfer-card-item">
                  <div className="transfer-header-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{item.title}</span>
                      <span className="retention-chip">
                        <Clock size={11} />
                        <span>{getRemainingTime(item.createdAt)}</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(item.content);
                          showToast('Content copied', 'success');
                        }}
                        title="Copy content"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        className="btn btn-sm btn-danger-outline btn-icon-only"
                        onClick={() => handleDeleteTransfer(item.id)}
                        title="Delete transmission"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="transfer-content-box">
                    {item.contentType === 'link' ? (
                      <a
                        href={item.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary-accent)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>{item.content}</span>
                        <ExternalLink size={13} />
                      </a>
                    ) : (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                        {item.content}
                      </pre>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                    <span>From: {item.senderName} ({item.senderToken})</span>
                    {item.burnAfterRead && <span style={{ color: 'var(--danger)' }}>🔥 Burns after read</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
