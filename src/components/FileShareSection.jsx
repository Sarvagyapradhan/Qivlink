import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, File, Download, Trash2, Copy, Check, QrCode, ExternalLink, HardDrive, AlertCircle
} from 'lucide-react';
import { uploadFileToCloud, getActiveFiles, deleteFileFromCloud, getRemainingTime, MAX_FILE_SIZE } from '../supabase.js';

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function FileShareSection({ showToast, onSelectForQr }) {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);

  const loadFiles = async () => {
    try {
      const active = await getActiveFiles();
      setFiles(active);
    } catch (e) {
      console.warn('Files read error:', e);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showToast('File exceeds the 10MB Supabase storage limit', 'danger');
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadFileToCloud(file);
      showToast(`Uploaded ${file.name} successfully`, 'success');
      setFiles(prev => [uploaded, ...prev]);
    } catch (err) {
      showToast(err.message || 'File upload failed', 'danger');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (id) => {
    try {
      const remaining = await deleteFileFromCloud(id);
      setFiles(remaining);
      showToast('File deleted', 'success');
    } catch (e) {
      showToast('Failed to delete file', 'danger');
    }
  };

  const handleCopyLink = (file) => {
    navigator.clipboard.writeText(file.url);
    setCopiedId(file.id);
    showToast('Download link copied', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="file-share-container">
      <div className="clean-header">
        <h1 className="clean-title">File Sharing</h1>
        <p className="clean-desc">
          Upload files up to 10MB. Automatically stored for 7 days with instant download links and QR codes.
        </p>
      </div>

      <div className="glass-panel">
        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary-accent)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '36px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'var(--accent-soft)' : 'var(--bg-subtle)',
            transition: 'all 0.15s ease'
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--bg-surface)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            color: 'var(--primary-accent)'
          }}>
            <Upload size={22} />
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px' }}>
            {isUploading ? 'Uploading file to cloud storage...' : 'Click to upload or drag & drop'}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
            PDF, Images, Documents, Audio, Zip (Max 10MB per file)
          </p>
        </div>

        {/* Uploaded Files Table */}
        <div style={{ marginTop: '28px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>
            Active Files ({files.length})
          </h4>

          {files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '0.86rem' }}>
              No files uploaded yet. Files expire automatically after 7 days.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {files.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--accent-soft)',
                      color: 'var(--primary-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <File size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-all' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'flex', gap: '8px' }}>
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span className="retention-chip" style={{ padding: '1px 6px', fontSize: '0.72rem' }}>
                          ⏱️ {getRemainingTime(file.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary btn-icon-only"
                      onClick={() => handleCopyLink(file)}
                      title="Copy download link"
                    >
                      {copiedId === file.id ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-secondary btn-icon-only"
                      onClick={() => onSelectForQr && onSelectForQr(file.url)}
                      title="Generate QR Code"
                    >
                      <QrCode size={14} />
                    </button>

                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={file.name}
                      className="btn btn-sm btn-secondary btn-icon-only"
                      title="Download file"
                    >
                      <Download size={14} />
                    </a>

                    <button
                      type="button"
                      className="btn btn-sm btn-danger-outline btn-icon-only"
                      onClick={() => handleDelete(file.id)}
                      title="Delete file"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
