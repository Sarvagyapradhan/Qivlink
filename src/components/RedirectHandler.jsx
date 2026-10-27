import React, { useState, useEffect } from 'react';
import { resolveLink } from '../utils/linkManager.js';
import { ExternalLink, ShieldCheck, ArrowRight, AlertCircle, Clock } from 'lucide-react';

export default function RedirectHandler({ shortCode, onBackToApp }) {
  const [status, setStatus] = useState('resolving'); // 'resolving' | 'redirecting' | 'expired' | 'not_found'
  const [targetUrl, setTargetUrl] = useState('');
  const [linkInfo, setLinkInfo] = useState(null);
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    let isMounted = true;

    async function handleRedirect() {
      try {
        const link = await resolveLink(shortCode);
        if (!isMounted) return;

        if (!link) {
          setStatus('not_found');
          return;
        }

        // Strict security verification: ensure only valid http/https URLs are executed
        try {
          const urlObj = new URL(link.targetUrl);
          if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            setStatus('not_found');
            return;
          }
        } catch (e) {
          setStatus('not_found');
          return;
        }

        setLinkInfo(link);
        setTargetUrl(link.targetUrl);
        setStatus('redirecting');

        // Automatic redirect countdown
        let remaining = 2;
        const timer = setInterval(() => {
          remaining -= 1;
          if (isMounted) setCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(timer);
            // Instant zero-tracking privacy navigation
            window.location.replace(link.targetUrl);
          }
        }, 1000);

        return () => clearInterval(timer);
      } catch (err) {
        if (isMounted) setStatus('not_found');
      }
    }

    handleRedirect();

    return () => {
      isMounted = false;
    };
  }, [shortCode]);

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '36px 28px' }}>
        {status === 'resolving' && (
          <div>
            <div className="spin-anim" style={{ display: 'inline-block', marginBottom: '16px' }}>
              <ShieldCheck size={36} color="var(--primary-accent)" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>Resolving Privacy Link</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Validating 7-day retention integrity and sanitizing telemetry...
            </p>
          </div>
        )}

        {status === 'redirecting' && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <span className="pulse-dot" style={{ display: 'inline-block', width: '10px', height: '10px', marginRight: '6px' }} />
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--success)' }}>
                Zero-Tracking Clean Redirect
              </span>
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '10px' }}>
              Redirecting in {countdown}s
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', wordBreak: 'break-all', marginBottom: '20px' }}>
              Destination: <strong style={{ color: 'var(--text-primary)' }}>{targetUrl}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={targetUrl}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                <span>Proceed Now</span>
                <ArrowRight size={16} />
              </a>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onBackToApp}
              >
                Cancel & Open Qivlink Studio
              </button>
            </div>
          </div>
        )}

        {status === 'not_found' && (
          <div>
            <div style={{ color: 'var(--danger)', marginBottom: '14px' }}>
              <AlertCircle size={40} style={{ display: 'inline-block' }} />
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>
              Link Expired or Not Found
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '24px' }}>
              All Qivlink short URLs are designed for strict privacy with an automated 7-day rolling lifecycle. This link may have expired or was removed.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onBackToApp}
            >
              Return to Qivlink Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
