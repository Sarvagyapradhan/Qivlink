import React, { useState } from 'react';
import { Link2, Copy, Check, QrCode, ExternalLink, ShieldCheck, ArrowRight, Radio } from 'lucide-react';
import confetti from 'canvas-confetti';
import { createShortLink } from '../utils/linkManager.js';
import { getRemainingTime } from '../supabase.js';

export default function ShortenerSection({
  deviceToken,
  onLinkCreated,
  onSelectForQr,
  onSelectForBeam,
  showToast
}) {
  const [url, setUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [title, setTitle] = useState('');
  const [stripTracking, setStripTracking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      showToast('Please enter a destination URL', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const newLink = await createShortLink({
        url,
        customAlias,
        title,
        stripTracking,
        deviceToken
      });

      setLastCreated(newLink);
      setUrl('');
      setCustomAlias('');
      setTitle('');
      showToast('Link shortened successfully', 'success');

      try {
        confetti({
          particleCount: 25,
          spread: 50,
          origin: { y: 0.6 }
        });
      } catch (err) {}

      if (onLinkCreated) {
        onLinkCreated(newLink);
      }
    } catch (err) {
      showToast(err.message || 'Failed to shorten URL', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentHost = window.location.origin;
  const shortUrl = lastCreated ? `${currentHost}/#/r/${lastCreated.shortCode}` : '';

  const handleCopy = () => {
    if (!shortUrl) return;
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    showToast('Short link copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="shortener-container">
      {/* Clean, Non-AI Header */}
      <div className="clean-header">
        <h1 className="clean-title">Link Shortener</h1>
        <p className="clean-desc">
          Instant link generation with zero tracking and offline QR exports.
        </p>
      </div>

      <div className="glass-panel">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="url-input" className="form-label">Destination URL</label>
              <span className="form-hint">HTTPS / HTTP</span>
            </div>
            <div className="input-wrapper">
              <Link2 size={18} className="input-icon-left" />
              <input
                id="url-input"
                type="text"
                className="input-text"
                placeholder="https://example.com/long-article-link"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="alias-input" className="form-label">Custom Alias (Optional)</label>
              </div>
              <div className="input-wrapper">
                <input
                  id="alias-input"
                  type="text"
                  className="input-text no-icon input-mono"
                  placeholder="e.g. project-doc"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="title-input" className="form-label">Title / Note (Optional)</label>
              </div>
              <div className="input-wrapper">
                <input
                  id="title-input"
                  type="text"
                  className="input-text no-icon"
                  placeholder="e.g. Design brief"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          {/* Privacy Toggle */}
          <div className="toggle-row">
            <div className="toggle-info">
              <span className="toggle-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} color="#059669" />
                Strip Tracking Parameters (UTMs, fbclid, gclid)
              </span>
              <span className="toggle-desc">
                Removes telemetry identifiers before redirecting.
              </span>
            </div>
            <label className="switch-pill">
              <input
                type="checkbox"
                checked={stripTracking}
                onChange={(e) => setStripTracking(e.target.checked)}
              />
              <span className="slider-round" />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
              7-day retention
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Shortening...' : 'Generate Short Link'}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>

        {/* Instant Result Box */}
        {lastCreated && (
          <div className="result-box">
            <div className="result-main">
              <div className="result-url-display">
                <span className="result-label">Generated Link</span>
                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-link-text"
                >
                  {shortUrl}
                </a>
              </div>

              <div className="result-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSelectForQr && onSelectForQr(shortUrl)}
                  title="Generate Offline QR"
                >
                  <QrCode size={14} />
                  <span>QR Code</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSelectForBeam && onSelectForBeam(shortUrl, lastCreated.title)}
                  title="Share link to another device"
                >
                  <Radio size={14} />
                  <span>Share</span>
                </button>

                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  title="Open link"
                >
                  <ExternalLink size={14} />
                  <span>Open</span>
                </a>
              </div>
            </div>

            <div className="result-meta-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Target:</span>
                <span style={{ maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lastCreated.targetUrl}
                </span>
              </div>
              <div className="retention-chip">
                <span>⏱️</span>
                <span>{getRemainingTime(lastCreated.createdAt)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
