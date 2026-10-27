import React, { useState } from 'react';
import {
  Clock, Search, Trash2, Copy, Check, QrCode, ExternalLink, RefreshCw, Link2, FileText, File
} from 'lucide-react';
import { deleteLink } from '../utils/linkManager.js';
import { deletePasteDoc, deleteFileFromCloud, getRemainingTime } from '../supabase.js';

export default function HistorySection({
  links = [],
  pastes = [],
  files = [],
  onLinkDeleted,
  onPasteDeleted,
  onFileDeleted,
  onRefresh,
  onSelectForQr,
  currentDeviceToken,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'links' | 'pastes' | 'files'
  const [copiedId, setCopiedId] = useState(null);

  const currentHost = window.location.origin;

  // Strict device isolation with case-insensitive matching
  const tokenClean = (currentDeviceToken || '').trim().toLowerCase();
  const myLinks = links.filter(l => !tokenClean || !l.creatorDevice || l.creatorDevice.toLowerCase() === tokenClean);
  const myPastes = pastes.filter(p => !tokenClean || !p.creatorDevice || p.creatorDevice.toLowerCase() === tokenClean);
  const myFiles = files.filter(f => !tokenClean || !f.creatorDevice || f.creatorDevice.toLowerCase() === tokenClean);

  const filteredLinks = myLinks.filter((link) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (link.shortCode && link.shortCode.toLowerCase().includes(term)) ||
      (link.targetUrl && link.targetUrl.toLowerCase().includes(term)) ||
      (link.title && link.title.toLowerCase().includes(term))
    );
  });

  const filteredPastes = myPastes.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.title && p.title.toLowerCase().includes(term)) ||
      (p.code && p.code.toLowerCase().includes(term)) ||
      (p.content && p.content.toLowerCase().includes(term))
    );
  });

  const filteredFiles = myFiles.filter((f) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return f.name && f.name.toLowerCase().includes(term);
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteLink = async (id) => {
    try {
      await deleteLink(id, currentDeviceToken);
      showToast('Short link deleted', 'success');
      if (onLinkDeleted) onLinkDeleted(id);
    } catch (e) {
      showToast('Delete failed', 'danger');
    }
  };

  const handleDeletePaste = async (id) => {
    try {
      await deletePasteDoc(id, currentDeviceToken);
      showToast('Paste doc deleted', 'success');
      if (onPasteDeleted) onPasteDeleted(id);
    } catch (e) {
      showToast('Delete failed', 'danger');
    }
  };

  const handleDeleteFile = async (id) => {
    try {
      await deleteFileFromCloud(id, currentDeviceToken);
      showToast('File deleted', 'success');
      if (onFileDeleted) onFileDeleted(id);
    } catch (e) {
      showToast('Delete failed', 'danger');
    }
  };

  return (
    <div className="history-container">
      <div className="clean-header">
        <h1 className="clean-title">History</h1>
        <p className="clean-desc">
          Items created on this device. All data automatically expires after 7 days.
        </p>
      </div>

      <div className="glass-panel">
        {/* Controls Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="input-wrapper" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={16} className="input-icon-left" />
            <input
              type="text"
              className="input-text"
              placeholder="Search links, pastes, or files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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

        {/* Links Section */}
        {(filterType === 'all' || filterType === 'links') && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link2 size={16} color="var(--primary-accent)" />
              <span>Short Links ({filteredLinks.length})</span>
            </h3>

            {filteredLinks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                No active links found on this device.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="history-desktop-table vault-table-wrapper">
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

                {/* Mobile Cards View */}
                <div className="history-mobile-cards">
                  {filteredLinks.map((link) => {
                    const fullUrl = `${currentHost}/#/r/${link.shortCode}`;
                    return (
                      <div key={link.id} className="history-mobile-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.94rem' }}>{link.title || link.shortCode}</div>
                            <div className="input-mono" style={{ fontSize: '0.78rem', color: 'var(--primary-accent)' }}>
                              /{link.shortCode}
                            </div>
                          </div>
                          <span className="retention-chip" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                            ⏱️ {getRemainingTime(link.createdAt)}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', wordBreak: 'break-all', marginBottom: '10px' }}>
                          {link.targetUrl}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-default)' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            {link.clicks || 0} clicks
                          </span>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="btn btn-sm btn-secondary btn-icon-only"
                              onClick={() => handleCopy(fullUrl, link.id)}
                              title="Copy"
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
                            <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary btn-icon-only" title="Open">
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Pastes / Docs Section */}
        {(filterType === 'all' || filterType === 'pastes') && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} color="var(--primary-accent)" />
              <span>Pastes & Docs ({filteredPastes.length})</span>
            </h3>

            {filteredPastes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                No active pastes found on this device.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredPastes.map(p => {
                  const docUrl = `${currentHost}/#/p/${p.code}`;
                  return (
                    <div
                      key={p.id}
                      className="history-item-row"
                    >
                      <div style={{ minWidth: '180px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                          ⏱️ {getRemainingTime(p.createdAt)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          className="btn btn-sm btn-secondary btn-icon-only"
                          onClick={() => handleCopy(docUrl, p.id)}
                          title="Copy Link"
                        >
                          {copiedId === p.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                        </button>
                        <button
                          className="btn btn-sm btn-secondary btn-icon-only"
                          onClick={() => onSelectForQr && onSelectForQr(docUrl)}
                          title="QR Code"
                        >
                          <QrCode size={13} />
                        </button>
                        <a href={docUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary btn-icon-only" title="Open">
                          <ExternalLink size={13} />
                        </a>
                        <button
                          className="btn btn-sm btn-danger-outline btn-icon-only"
                          onClick={() => handleDeletePaste(p.id)}
                          title="Delete Paste"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Files Section */}
        {(filterType === 'all' || filterType === 'files') && (
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <File size={16} color="var(--primary-accent)" />
              <span>Uploaded Files ({filteredFiles.length})</span>
            </h3>

            {filteredFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                No active files found on this device.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredFiles.map(f => (
                  <div
                    key={f.id}
                    className="history-item-row"
                  >
                    <div style={{ minWidth: '180px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-all' }}>{f.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                        ⏱️ {getRemainingTime(f.createdAt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        className="btn btn-sm btn-secondary btn-icon-only"
                        onClick={() => handleCopy(f.url, f.id)}
                        title="Copy Link"
                      >
                        {copiedId === f.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary btn-icon-only"
                        onClick={() => onSelectForQr && onSelectForQr(f.url)}
                        title="QR Code"
                      >
                        <QrCode size={13} />
                      </button>
                      <a href={f.url} download={f.name} className="btn btn-sm btn-secondary btn-icon-only" title="Download">
                        <ExternalLink size={13} />
                      </a>
                      <button
                        className="btn btn-sm btn-danger-outline btn-icon-only"
                        onClick={() => handleDeleteFile(f.id)}
                        title="Delete File"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
