import React, { useState, useRef } from 'react';
import {
  FileText, Eye, Edit3, Bold, Italic, Heading, Code, List,
  Quote, Download, Share2, Copy, Check, QrCode, ExternalLink, Printer
} from 'lucide-react';
import { marked } from 'marked';
import { createPasteDoc } from '../supabase.js';

export default function PasteDocSection({ showToast, onSelectForQr }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState('write'); // 'write' | 'preview'
  const [isSaving, setIsSaving] = useState(false);
  const [savedDoc, setSavedDoc] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const textareaRef = useRef(null);

  // Formatting helpers
  const applyFormatting = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);

    const replacement = prefix + (selected || 'text') + suffix;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 50);
  };

  const handleShare = async () => {
    if (!content.trim()) {
      showToast('Please enter some text or markdown content', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const doc = await createPasteDoc({
        title,
        content,
        format: 'markdown'
      });
      setSavedDoc(doc);
      showToast('Content published with 7-day retention', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save paste', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const currentHost = window.location.origin;
  const docShareUrl = savedDoc ? `${currentHost}/#/p/${savedDoc.code}` : '';

  const handleCopyLink = () => {
    if (!docShareUrl) return;
    navigator.clipboard.writeText(docShareUrl);
    setCopiedLink(true);
    showToast('Document link copied to clipboard', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Convert/Print to PDF
  const handleExportPdf = () => {
    if (!content.trim()) {
      showToast('Enter some content first', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank');
    const renderedHtml = marked.parse(content);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || 'Qivlink Document'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #111; max-width: 800px; margin: 40px auto; padding: 0 20px; }
            h1, h2, h3 { color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            pre { background: #f1f5f9; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: monospace; }
            code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
            blockquote { border-left: 4px solid #2563eb; margin: 0; padding-left: 16px; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background: #f8fafc; }
            @media print { body { margin: 20mm; } }
          </style>
        </head>
        <body>
          <h1>${title || 'Document'}</h1>
          <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 24px;">Generated via Qivlink · 7-day retention</div>
          <div>${renderedHtml}</div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export as Markdown File
  const handleExportMarkdown = () => {
    if (!content.trim()) {
      showToast('Enter some content first', 'warning');
      return;
    }
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (title ? title.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'document') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Markdown file downloaded', 'success');
  };

  return (
    <div className="paste-doc-container">
      <div className="clean-header">
        <h1 className="clean-title">Paste & Docs</h1>
        <p className="clean-desc">
          Paste notes, docs, or code of any length. Format with Markdown, export to PDF, and share via short link or QR.
        </p>
      </div>

      <div className="glass-panel">
        <div style={{ marginBottom: '14px' }}>
          <label htmlFor="doc-title" className="form-label">Document Title (Optional)</label>
          <input
            id="doc-title"
            type="text"
            className="input-text no-icon"
            placeholder="e.g. Project Specs, Meeting Minutes, or API Guide..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Toolbar & View Switcher */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          background: 'var(--bg-subtle)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '10px',
          border: '1px solid var(--border-default)'
        }}>
          {/* Formatting buttons */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              type="button"
              className="icon-btn"
              style={{ width: '32px', height: '32px' }}
              onClick={() => applyFormatting('**', '**')}
              title="Bold"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ width: '32px', height: '32px' }}
              onClick={() => applyFormatting('*', '*')}
              title="Italic"
            >
              <Italic size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ width: '32px', height: '32px' }}
              onClick={() => applyFormatting('### ')}
              title="Heading"
            >
              <Heading size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ width: '32px', height: '32px' }}
              onClick={() => applyFormatting('```\n', '\n```')}
              title="Code Block"
            >
              <Code size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ width: '32px', height: '32px' }}
              onClick={() => applyFormatting('- ')}
              title="Bullet List"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              style={{ width: '32px', height: '32px' }}
              onClick={() => applyFormatting('> ')}
              title="Quote"
            >
              <Quote size={14} />
            </button>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'write' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('write')}
            >
              <Edit3 size={13} />
              <span>Write</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('preview')}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>
        </div>

        {/* Editor or Preview */}
        {viewMode === 'write' ? (
          <textarea
            ref={textareaRef}
            className="textarea-custom input-mono"
            style={{ minHeight: '260px', fontSize: '0.92rem', lineHeight: '1.6' }}
            placeholder="Write or paste any length of text or markdown content here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        ) : (
          <div
            style={{
              minHeight: '260px',
              padding: '16px',
              background: 'var(--bg-surface)',
              border: '1.5px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              overflowY: 'auto',
              maxHeight: '400px'
            }}
            dangerouslySetInnerHTML={{
              __html: content ? marked.parse(content) : '<p style="color: var(--text-tertiary);">Nothing to preview yet. Switch to Write to add content.</p>'
            }}
          />
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportPdf}
              title="Print or export as PDF"
            >
              <Printer size={14} />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportMarkdown}
              title="Download as Markdown file"
            >
              <Download size={14} />
              <span>Save .md</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleShare}
            disabled={isSaving}
          >
            <Share2 size={15} />
            <span>{isSaving ? 'Publishing...' : 'Share Document'}</span>
          </button>
        </div>

        {/* Share Output Card */}
        {savedDoc && (
          <div className="result-box" style={{ marginTop: '20px' }}>
            <div className="result-main">
              <div className="result-url-display">
                <span className="result-label">Shareable Document Link</span>
                <a
                  href={docShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-link-text"
                >
                  {docShareUrl}
                </a>
              </div>

              <div className="result-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyLink}
                >
                  {copiedLink ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSelectForQr && onSelectForQr(docShareUrl)}
                >
                  <QrCode size={14} />
                  <span>QR Code</span>
                </button>

                <a
                  href={docShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <ExternalLink size={14} />
                  <span>View Doc</span>
                </a>
              </div>
            </div>
            <div className="result-meta-row">
              <span>Title: {savedDoc.title}</span>
              <span className="retention-chip">⏱️ 7 days</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
