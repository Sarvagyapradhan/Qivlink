import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
import { Copy, Check, Printer, ArrowLeft, Clock, FileText } from 'lucide-react';
import { getPasteByIdOrCode, getRemainingTime } from '../supabase.js';

export default function PasteViewer({ code, onBackToApp }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchDoc() {
      try {
        const found = await getPasteByIdOrCode(code);
        setDoc(found);
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [code]);

  const handleCopy = () => {
    if (!doc) return;
    navigator.clipboard.writeText(doc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
        Loading document...
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ maxWidth: '580px', margin: '40px auto', padding: '0 20px' }}>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Document Not Found or Expired</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
            This document may have exceeded the 7-day retention period or was deleted by its author.
          </p>
          <button className="btn btn-primary btn-sm" onClick={onBackToApp}>
            <ArrowLeft size={14} />
            <span>Go to Qvlink Home</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '820px', margin: '20px auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBackToApp}>
          <ArrowLeft size={14} />
          <span>Home</span>
        </button>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="retention-chip">
            <Clock size={12} />
            <span>{getRemainingTime(doc.createdAt)}</span>
          </span>

          <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
            {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy Text'}</span>
          </button>

          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            <Printer size={14} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>
          {doc.title || 'Shared Document'}
        </h1>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '24px', paddingBottom: '14px', borderBottom: '1px solid var(--border-default)' }}>
          Published via Qvlink · Retained for 7 days
        </div>

        <div
          style={{ lineHeight: '1.7', fontSize: '0.96rem' }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(marked.parse(doc.content)) }}
        />
      </div>
    </div>
  );
}
