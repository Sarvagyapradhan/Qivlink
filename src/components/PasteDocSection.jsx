import React, { useState, useRef } from 'react';
import {
  FileText, Eye, Edit3, Bold, Italic, Heading1, Heading2, Code, List,
  ListOrdered, Quote, Minus, Download, Share2, Copy, Check, QrCode, ExternalLink, Printer, Sparkles
} from 'lucide-react';
import { marked } from 'marked';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
import { createPasteDoc } from '../supabase.js';
import { verifyToolUsage, consumeToolUsage } from '../utils/rateLimiter.js';

export default function PasteDocSection({
  deviceToken = '',
  currentUser = null,
  onDocCreated,
  onLimitReached,
  showToast,
  onSelectForQr
}) {
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

    // Rate limit check for guest users (1 per 24h)
    const limitCheck = await verifyToolUsage('paste', currentUser);
    if (!limitCheck.allowed) {
      if (onLimitReached) {
        onLimitReached('paste', limitCheck.hoursLeft);
      } else {
        showToast(`Free daily limit reached (1/1 per 24h). Resets in ${limitCheck.hoursLeft}h. Sign in for unlimited!`, 'warning');
      }
      return;
    }

    setIsSaving(true);
    try {
      const doc = await createPasteDoc({
        title,
        content,
        format: 'markdown',
        deviceToken,
        currentUser
      });
      setSavedDoc(doc);
      await consumeToolUsage('paste', currentUser);
      if (onDocCreated) onDocCreated(doc);
      showToast('Document published with 7-day retention', 'success');
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
          <title>${title || 'Qvlink Document'}</title>
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
          <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 24px;">Generated via Qvlink · 7-day retention</div>
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
    a.download = (title ? title.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'qvlink-document') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Markdown file downloaded', 'success');
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="paste-doc-container">
      <div className="clean-header">
        <h1 className="clean-title">Paste & Docs</h1>
        <p className="clean-desc">
          Publish long-form notes, specs, or code with instant Markdown formatting, PDF export, and shareable QR.
        </p>
      </div>

      <div className="glass-panel">
        {/* Title Input Card */}
        <div style={{ marginBottom: '16px' }}>
          <div className="form-label-row">
            <label htmlFor="doc-title" className="form-label">Document Title (Optional)</label>
            <span className="form-hint">Shown in browser tab and PDF header</span>
          </div>
          <input
            id="doc-title"
            type="text"
            className="input-text no-icon"
            placeholder="e.g. Architecture Overview, Meeting Minutes, or API Specs..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Redesigned Responsive Editor Control Bar */}
        <div className="paste-control-header">
          {/* Segmented View Switcher */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${viewMode === 'write' ? 'active' : ''}`}
              onClick={() => setViewMode('write')}
            >
              <Edit3 size={13} />
              <span>Write</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>

          {/* Word / Char Counter */}
          <div className="paste-stats-counter">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} chars</span>
          </div>
        </div>

        {/* Responsive Formatting Toolbar (Scrollable on mobile) */}
        {viewMode === 'write' && (
          <div className="paste-toolbar-container">
            <div className="paste-toolbar-scroll">
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormatting('**', '**')}
                title="Bold (Ctrl+B)"
              >
                <Bold size={13} />
                <span>Bold</span>
              </button>

              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormatting('*', '*')}
                title="Italic (Ctrl+I)"
              >
                <Italic size={13} />
                <span>Italic</span>
              </button>

              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormatting('## ')}
                title="Heading 2"
              >
                <Heading1 size={13} />
                <span>H2</span>
              </button>

              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormatting('### ')}
                title="Heading 3"
              >
                <Heading2 size={13} />
                <span>H3</span>
              </button>

              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormatting('```\n', '\n```')}
                title="Code Block"
              >
                <Code size={13} />
                <span>Code Block</span>
              </button>

              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormatting('- ')}
                title="Bullet List"
              >
                <List size={13} />
                <span>Bullet</span>
              </button>

              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormatting('1. ')}
                title="Numbered List"
              >
                <ListOrdered size={13} />
                <span>Numbered</span>
              </button>

              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormatting('> ')}
                title="Blockquote"
              >
                <Quote size={13} />
                <span>Quote</span>
              </button>

              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormatting('\n---\n')}
                title="Horizontal Divider"
              >
                <Minus size={13} />
                <span>Divider</span>
              </button>
            </div>
          </div>
        )}

        {/* Editor or Preview Area */}
        {viewMode === 'write' ? (
          <div className="editor-card-wrapper">
            <textarea
              ref={textareaRef}
              className="textarea-custom input-mono paste-editor-textarea"
              placeholder="# Write or paste any length of text or markdown content here...&#10;&#10;Use the toolbar above or standard markdown syntax."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        ) : (
          <div className="preview-card-wrapper">
            {content ? (
              <div
                className="markdown-rendered-view"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(marked.parse(content)) }}
              />
            ) : (
              <div className="preview-empty-state">
                <FileText size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p>Nothing to preview yet. Switch back to Write to compose your document.</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons Bar */}
        <div className="paste-actions-bar">
          <div className="export-btn-group">
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
            <span>{isSaving ? 'Publishing...' : 'Publish & Share'}</span>
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
                  {copiedLink ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
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
              <div className="retention-chip">
                <span>⏱️ 7-day retention</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
