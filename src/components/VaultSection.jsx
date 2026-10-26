import React, { useState } from 'react';
import {
  HardDrive, Search, Trash2, Copy, Check, QrCode, ExternalLink,
  Clock, Shield, Radio, RefreshCw, Filter
} from 'lucide-react';
import { deleteLink } from '../utils/linkManager.js';
import { getRemainingTime } from '../supabase.js';

export default function VaultSection({
  links = [],
  onLinkDeleted,
  onRefresh,
  onSelectForQr,
  onSelectForBeam,
  currentDeviceToken,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDeviceOnly, setFilterDeviceOnly] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentHost = window.location.origin;

  const filteredLinks = links.filter((link) => {
    if (filterDeviceOnly && link.creatorDevice !== currentDeviceToken) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      link.shortCode.toLowerCase().includes(term) ||
      link.targetUrl.toLowerCase().includes(term) ||
      (link.title && link.title.toLowerCase().includes(term))
    );
  });

  const handleCopy = (link) => {
    const fullUrl = `${currentHost}/#/r/${link.shortCode}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(link.id);
    showToast('Link copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this link?')) return;
    setIsDeleting(true);
    try {
      const updated = await deleteLink(id);
      showToast('Link removed from vault', 'success');
      if (onLinkDeleted) onLinkDeleted(updated);
    } catch (e) {
      showToast('Failed to delete link', 'danger');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="vault-wrapper">
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title-group">
            <div className="panel-icon-badge">
              <HardDrive size={18} />
            </div>
            <div>
              <h2 className="panel-title">Links Vault</h2>
              <p className="panel-description">
                Active shortened links and remaining duration.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="icon-btn"
              onClick={onRefresh}
              title="Refresh links"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
            <Search size={16} className="input-icon-left" />
            <input
              type="text"
              className="input-text"
              placeholder="Search by alias, title, or target URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            type="button"
            className={`btn btn-sm ${filterDeviceOnly ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterDeviceOnly(!filterDeviceOnly)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Filter size={13} />
            <span>{filterDeviceOnly ? 'Showing My Device' : 'Show All Devices'}</span>
          </button>
        </div>

        {/* Vault Table */}
        {filteredLinks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
            <HardDrive size={36} style={{ opacity: 0.35, marginBottom: '12px' }} />
            <p>No active links found matching your filter.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Create a link in the Shorten tab to populate your rolling 7-day vault.
            </p>
          </div>
        ) : (
          <div className="vault-table-wrapper">
            <table className="vault-table">
              <thead>
                <tr>
                  <th>Short Link</th>
                  <th>Destination</th>
                  <th>TTL / Expiry</th>
                  <th>Clicks</th>
                  <th>Device</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.map((link) => {
                  const fullUrl = `${currentHost}/#/r/${link.shortCode}`;
                  return (
                    <tr key={link.id} className="vault-row">
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                            {link.title || link.shortCode}
                          </span>
                          <span className="input-mono" style={{ fontSize: '0.78rem', color: 'var(--primary-accent)' }}>
                            /{link.shortCode}
                          </span>
                        </div>
                      </td>

                      <td style={{ maxWidth: '240px' }}>
                        <a
                          href={link.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.84rem'
                          }}
                          title={link.targetUrl}
                        >
                          {link.targetUrl}
                        </a>
                      </td>

                      <td>
                        <span className="retention-chip">
                          <Clock size={11} />
                          <span>{getRemainingTime(link.createdAt)}</span>
                        </span>
                      </td>

                      <td>
                        <span className="input-mono" style={{ fontSize: '0.86rem' }}>
                          {link.clicks || 0}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          {link.creatorDevice ? link.creatorDevice.substring(0, 8) + '...' : 'Unknown'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary btn-icon-only"
                            onClick={() => handleCopy(link)}
                            title="Copy short link"
                          >
                            {copiedId === link.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-secondary btn-icon-only"
                            onClick={() => onSelectForQr && onSelectForQr(fullUrl)}
                            title="Open in QR Studio"
                          >
                            <QrCode size={13} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-secondary btn-icon-only"
                            onClick={() => onSelectForBeam && onSelectForBeam(fullUrl, link.title)}
                            title="Beam to another device"
                          >
                            <Radio size={13} />
                          </button>

                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-secondary btn-icon-only"
                            title="Test redirect"
                          >
                            <ExternalLink size={13} />
                          </a>

                          <button
                            type="button"
                            className="btn btn-sm btn-danger-outline btn-icon-only"
                            onClick={() => handleDelete(link.id)}
                            title="Revoke and delete"
                            disabled={isDeleting}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
