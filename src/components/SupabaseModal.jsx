import React, { useState } from 'react';
import { X, Database, Check, Copy, Shield, Terminal, ArrowUpRight } from 'lucide-react';
import { SUPABASE_CONFIG } from '../supabase.js';

const SQL_MIGRATION_SCRIPT = `-- ====================================================================
-- QIVLINK SUPABASE POSTGRESQL SCHEMA WITH 7-DAY AUTO PURGE
-- ====================================================================

-- 1. Links Table
CREATE TABLE IF NOT EXISTS public.links (
  id TEXT PRIMARY KEY,
  short_code TEXT UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  title TEXT,
  strip_tracking BOOLEAN DEFAULT true,
  creator_device TEXT,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 2. Device Transfers Table
CREATE TABLE IF NOT EXISTS public.device_transfers (
  id TEXT PRIMARY KEY,
  target_token TEXT,
  pickup_code TEXT,
  sender_token TEXT NOT NULL,
  sender_name TEXT,
  content_type TEXT DEFAULT 'link',
  content TEXT NOT NULL,
  title TEXT,
  has_passcode BOOLEAN DEFAULT false,
  passcode TEXT,
  burn_after_read BOOLEAN DEFAULT false,
  read_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 3. Device Registry Table
CREATE TABLE IF NOT EXISTS public.device_registry (
  token TEXT PRIMARY KEY,
  name TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Automated 7-Day Cleanup Function
CREATE OR REPLACE FUNCTION public.clean_expired_qivlink_data()
RETURNS void AS $$
BEGIN
  -- Delete links older than 7 days
  DELETE FROM public.links WHERE created_at < (NOW() - INTERVAL '7 days');
  -- Delete transfers older than 7 days
  DELETE FROM public.device_transfers WHERE created_at < (NOW() - INTERVAL '7 days');
  -- Delete inactive devices older than 7 days
  DELETE FROM public.device_registry WHERE last_seen < (NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write links" ON public.links FOR ALL USING (true);
CREATE POLICY "Allow public read/write transfers" ON public.device_transfers FOR ALL USING (true);
CREATE POLICY "Allow public read/write registry" ON public.device_registry FOR ALL USING (true);
`;

export default function SupabaseModal({ isOpen, onClose, showToast }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
    setCopied(true);
    showToast('SQL schema copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="panel-icon-badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <Database size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Supabase Cloud Infrastructure</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Live Storage & REST Integration</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Configuration Summary Card */}
        <div style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border-subtle)', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Project Host</span>
            <span className="input-mono" style={{ fontWeight: 600 }}>wjjvobqwnnlzxsovjovx.supabase.co</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Storage Engine</span>
            <span style={{ color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />
              Active (Bucket: {SUPABASE_CONFIG.bucketName})
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Lifecycle Rule</span>
            <span style={{ color: 'var(--warning)', fontWeight: 600 }}>168h (7-Day) Rolling Purge</span>
          </div>
        </div>

        {/* SQL Schema helper */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} />
              PostgreSQL Tables & Auto-Purge SQL
            </span>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={handleCopySql}
            >
              {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy SQL'}</span>
            </button>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Qivlink already synchronizes all links and device beams automatically via verified Supabase cloud storage. If you also wish to query raw tables in Supabase Studio, run this SQL in your project SQL Editor:
          </p>

          <pre style={{
            background: 'var(--input-bg)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.74rem',
            fontFamily: 'var(--font-mono)',
            maxHeight: '180px',
            overflowY: 'auto',
            border: '1px solid var(--glass-border-subtle)',
            color: 'var(--text-secondary)'
          }}>
            {SQL_MIGRATION_SCRIPT}
          </pre>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
