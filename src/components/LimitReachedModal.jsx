import React from 'react';
import { X, Sparkles, Clock, ShieldCheck, ArrowRight, Zap } from 'lucide-react';

export default function LimitReachedModal({ isOpen, onClose, onOpenAuth, toolName = 'this tool', hoursLeft = 24 }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="brand-icon-box" style={{ width: '32px', height: '32px', background: 'var(--accent-soft)', color: 'var(--primary-accent)' }}>
              <Zap size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Daily Guest Limit Reached
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                1 free action per 24 hours for guests
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '8px 0 16px' }}>
          <div className="limit-card-banner">
            <Clock size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              You have already used the free tier for <strong>{toolName}</strong>. Resets in approximately <strong>{hoursLeft} hours</strong> on this device.
            </div>
          </div>

          <div style={{ margin: '18px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Sign up free for Unlimited Access:
            </div>
            <div className="benefit-item">
              <ShieldCheck size={16} color="var(--success)" />
              <span>Unlimited link shortens & custom aliases</span>
            </div>
            <div className="benefit-item">
              <ShieldCheck size={16} color="var(--success)" />
              <span>Unlimited offline QR exports & Markdown docs</span>
            </div>
            <div className="benefit-item">
              <ShieldCheck size={16} color="var(--success)" />
              <span>Developer API Key for automated integration</span>
            </div>
            <div className="benefit-item">
              <ShieldCheck size={16} color="var(--success)" />
              <span>7-day persistent cloud retention & cross-device sharing</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                onClose();
                onOpenAuth('signup');
              }}
            >
              <Sparkles size={16} />
              <span>Sign Up for Unlimited Access (Free)</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                onClose();
                onOpenAuth('signin');
              }}
            >
              <span>Already have an account? Sign In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
