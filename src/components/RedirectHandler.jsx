import React, { useState, useEffect } from 'react';
import { resolveLink } from '../utils/linkManager.js';
import { AlertCircle, ShieldAlert } from 'lucide-react';

export default function RedirectHandler({ shortCode, onBackToApp }) {
  const [status, setStatus] = useState('resolving'); // 'resolving' | 'not_found'

  useEffect(() => {
    let isMounted = true;

    async function handleRedirect() {
      try {
        const link = await resolveLink(shortCode);
        if (!isMounted) return;

        if (!link || !link.targetUrl) {
          setStatus('not_found');
          return;
        }

        let target = link.targetUrl.trim();
        if (!/^https?:\/\//i.test(target)) {
          target = 'https://' + target;
        }

        // Validate protocol security
        const urlObj = new URL(target);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          setStatus('not_found');
          return;
        }

        // Instantaneous redirect to the original destination URL without intermediary page delay
        window.location.replace(target);
      } catch (err) {
        if (isMounted) setStatus('not_found');
      }
    }

    handleRedirect();

    return () => {
      isMounted = false;
    };
  }, [shortCode]);

  if (status === 'not_found') {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '36px 24px' }}>
          <div style={{ color: 'var(--danger)', marginBottom: '14px' }}>
            <AlertCircle size={44} style={{ display: 'inline-block' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            Link Not Found or Expired
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '24px' }}>
            The short link <strong className="input-mono">/{shortCode}</strong> could not be found or has reached its 7-day retention limit.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={onBackToApp}
          >
            Go to Qvlink Home
          </button>
        </div>
      </div>
    );
  }

  // Minimal instantaneous resolving state while resolving in background
  return null;
}
