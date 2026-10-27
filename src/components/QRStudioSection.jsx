import React, { useState, useEffect, useRef } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import { renderToCanvas, downloadQrPng, copyQrToClipboard } from '../utils/qrGenerator.js';
import { verifyToolUsage, consumeToolUsage } from '../utils/rateLimiter.js';

export default function QRStudioSection({ initialValue = '', currentUser = null, onLimitReached, showToast }) {
  const [content, setContent] = useState(initialValue || window.location.origin);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (initialValue) {
      setContent(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    if (!canvasRef.current || !content) return;
    renderToCanvas(canvasRef.current, content, {
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240
    }).catch(console.warn);
  }, [content]);

  const handleDownload = async () => {
    const limitCheck = await verifyToolUsage('qr', currentUser);
    if (!limitCheck.allowed) {
      if (onLimitReached) onLimitReached('qr', limitCheck.hoursLeft);
      else showToast(`Free daily limit reached (1/1 per 24h). Resets in ${limitCheck.hoursLeft}h. Sign in for unlimited!`, 'warning');
      return;
    }

    try {
      await downloadQrPng(content, 'qvlink-qr.png', 1024, {
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        errorCorrectionLevel: 'M',
        margin: 2
      });
      await consumeToolUsage('qr', currentUser);
      showToast('QR code downloaded', 'success');
    } catch (e) {
      showToast('Download failed', 'danger');
    }
  };

  const handleCopy = async () => {
    const limitCheck = await verifyToolUsage('qr', currentUser);
    if (!limitCheck.allowed) {
      if (onLimitReached) onLimitReached('qr', limitCheck.hoursLeft);
      else showToast(`Free daily limit reached (1/1 per 24h). Resets in ${limitCheck.hoursLeft}h. Sign in for unlimited!`, 'warning');
      return;
    }

    try {
      await copyQrToClipboard(content, 512, {
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        errorCorrectionLevel: 'M',
        margin: 2
      });
      await consumeToolUsage('qr', currentUser);
      setCopied(true);
      showToast('QR code image copied', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      showToast('Could not copy image (use Download)', 'warning');
    }
  };

  return (
    <div style={{ maxWidth: '580px', margin: '0 auto' }}>
      <div className="clean-header">
        <h1 className="clean-title">QR Code</h1>
        <p className="clean-desc">Enter any text or URL to generate an instant QR code.</p>
      </div>

      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
          <label htmlFor="qr-input" className="form-label">Content or URL</label>
          <input
            id="qr-input"
            type="text"
            className="input-text no-icon"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="https://example.com or any text..."
          />
        </div>

        <div style={{
          display: 'inline-flex',
          padding: '16px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1.5px solid var(--border-default)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          marginBottom: '20px'
        }}>
          <canvas ref={canvasRef} />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
          >
            <Download size={15} />
            <span>Download QR</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
          >
            {copied ? <Check size={15} color="#059669" /> : <Copy size={15} />}
            <span>{copied ? 'Copied' : 'Copy Image'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
