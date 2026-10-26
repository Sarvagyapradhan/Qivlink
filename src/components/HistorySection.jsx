import React, { useState } from 'react';
import {
  Clock, Search, Trash2, Copy, Check, QrCode, ExternalLink, RefreshCw, Link2, FileText, File
} from 'lucide-react';
import { deleteLink } from '../utils/linkManager.js';
import { getRemainingTime } from '../supabase.js';

export default function HistorySection({
  links = [],
  pastes = [],
  files = [],
  onLinkDeleted,
  onRefresh,
  onSelectForQr,
  currentDeviceToken,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'links' | 'pastes' | 'files'
  const [copiedId, setCopiedId] = useState(null);

  const currentHost = window.location.origin;

  const filteredLinks = links.filter((link) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      link.shortCode.toLowerCase().includes(term) ||
      link.targetUrl.toLowerCase().includes(term) ||
      (link.title && link.title.toLowerCase().includes(term))
    );
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteLink = async (id) => {
    try {
      const updated = await deleteLink(id);
      showToast('Item deleted', 'success');
      if (onLinkDeleted) onLinkDeleted(updated);
    } catch (e) {
      showToast('Delete failed', 'danger');
    }
  };

  return (
    <div className="history-container">
      <div className="clean-header">
        <h1 className="clean-title">History</h1>
        <p className="clean-desc">
          Your active links, shared docs, and files. All items automatically expire after 7 days.
        </p>
      </div>

      <div className="glass-panel">
        {/* Controls Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="input-wrapper" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={16} className="input-icon-left" />
            <input
              type="text"
              className="input-text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'links', 'pastes', 'files'].map(type => (
              <button
                key={type}
                className={`btn btn-sm ${filterType === type ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform: 'capitalize' }}
                onClick={() => setFilterType(type)}
              >
                {type}
              </button>
            ))}
            <button className="icon-btn" onClick={onRefresh} title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Links Table */}
        {(filterType === 'all' || filterType === 'links') && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link2 size={16} color="var(--primary-accent)" />
              <span>Short Links ({filteredLinks.length})</span>
            </h3>

            {filteredLinks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                No active links found.
              </div>
            ) : (
              <div className="vault-table-wrapper">
                <table className="vault-table">
                  <thead>
                    <tr>
                      <th>Short Link</th>
                      <th>Destination</th>
                      <th>Expiry</th>
                      <th>Clicks</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLinks.map((link) => {
                      const fullUrl = `${currentHost}/#/r/${link.shortCode}`;
                      return (
                        <tr key={link.id} className="vault-row">
                          <td>
                            <div style={{ fontWeight: 600 }}>{link.title || link.shortCode}</div>
                            <div className="input-mono" style={{ fontSize: '0.78rem', color: 'var(--primary-accent)' }}>
                              /{link.shortCode}
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
                            >
                              {link.targetUrl}
                            </a>
                          </td>

                          <td>
                            <span className="retention-chip">
                              ⏱️ {getRemainingTime(link.createdAt)}
                            </span>
                          </td>

                          <td>
                            <span className="input-mono">{link.clicks || 0}</span>
                          </td>

                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                className="btn btn-sm btn-secondary btn-icon-only"
                                onClick={() => handleCopy(fullUrl, link.id)}
                                title="Copy link"
                              >
                                {copiedId === link.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                              </button>

                              <button
                                className="btn btn-sm btn-secondary btn-icon-only"
                                onClick={() => onSelectForQr && onSelectForQr(fullUrl)}
                                title="QR Code"
                              >
                                <QrCode size={13} />
                              </button>

                              <a
                                href={fullUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-secondary btn-icon-only"
                                title="Open"
                              >
                                <ExternalLink size={13} />
                              </a>

                              <button
                                className="btn btn-sm btn-danger-outline btn-icon-only"
                                onClick={() => handleDeleteLink(link.id)}
                                title="Delete"
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
        )}

        {/* Pastes / Docs Section */}
        {(filterType === 'all' || filterType === 'pastes') && pastes.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} color="var(--primary-accent)" />
              <span>Pastes & Docs ({pastes.length})</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pastes.map(p => {
                const docUrl = `${currentHost}/#/p/${p.code}`;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-subtle)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                        ⏱️ {getRemainingTime(p.createdAt)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-sm btn-secondary btn-icon-only"
                        onClick={() => handleCopy(docUrl, p.id)}
                      >
                        {copiedId === p.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary btn-icon-only"
                        onClick={() => onSelectForQr && onSelectForQr(docUrl)}
                      >
                        <QrCode size={13} />
                      </button>
                      <a href={docUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary btn-icon-only">
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Files Section */}
        {(filterType === 'all' || filterType === 'files') && files.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <File size={16} color="var(--primary-accent)" />
              <span>Uploaded Files ({files.length})</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map(f => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.name}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-sm btn-secondary btn-icon-only"
                      onClick={() => handleCopy(f.url, f.id)}
                    >
                      {copiedId === f.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                    </button>
                    <a href={f.url} download={f.name} className="btn btn-sm btn-secondary btn-icon-only">
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
