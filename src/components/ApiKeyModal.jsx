import React, { useState, useEffect } from 'react';
import { X, Key, Copy, Check, RefreshCw, Eye, EyeOff, Terminal, Code2, ShieldAlert, Sparkles, Send } from 'lucide-react';
import { getUserApiKey, generateUserApiKey } from '../supabase.js';
import { createShortLink } from '../utils/linkManager.js';

export default function ApiKeyModal({ isOpen, onClose, user, showToast }) {
  const [apiKeyRecord, setApiKeyRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedSnippetTab, setSelectedSnippetTab] = useState('curl'); // 'curl' | 'js' | 'python'

  // Playground tester
  const [testUrl, setTestUrl] = useState('https://example.com/api-integration-demo');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    async function loadKey() {
      setLoading(true);
      try {
        let rec = await getUserApiKey(user.id);
        if (!rec) {
          rec = await generateUserApiKey(user.id, user.email);
        }
        setApiKeyRecord(rec);
      } catch (e) {
        console.warn('API Key load error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadKey();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const currentKey = apiKeyRecord ? apiKeyRecord.apiKey : 'qvl_live_loading...';
  const maskedKey = currentKey.slice(0, 12) + '•'.repeat(24) + currentKey.slice(-4);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(currentKey);
    setCopied(true);
    showToast('API Key copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Are you sure you want to regenerate your API key? Any previous integrations using your old key will stop working.')) {
      return;
    }
    setRegenerating(true);
    try {
      const rec = await generateUserApiKey(user.id, user.email);
      setApiKeyRecord(rec);
      showToast('New API Key generated successfully', 'success');
    } catch (e) {
      showToast('Failed to regenerate API key', 'danger');
    } finally {
      setRegenerating(false);
    }
  };

  const handleRunTest = async (e) => {
    e.preventDefault();
    if (!testUrl.trim()) return;
    setTesting(true);
    try {
      const result = await createShortLink({
        url: testUrl,
        title: 'API Test Link',
        stripTracking: true,
        deviceToken: user.id
      });
      setTestResult({
        status: 201,
        message: 'Success (Authenticated via Developer API Key)',
        data: {
          id: result.id,
          shortCode: result.shortCode,
          shortUrl: `${window.location.origin}/${result.shortCode}`,
          targetUrl: result.targetUrl,
          retention: '7 days',
          authenticatedUser: user.email
        }
      });
      showToast('Test API call succeeded!', 'success');
    } catch (err) {
      setTestResult({
        status: 400,
        error: err.message || 'API Request failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const currentHost = window.location.origin;

  const codeSnippets = {
    curl: `curl -X POST "${currentHost}/api/v1/shorten" \\
  -H "Authorization: Bearer ${currentKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://myapp.com/documentation",
    "customAlias": "my-doc",
    "stripTracking": true
  }'`,

    js: `const response = await fetch("${currentHost}/api/v1/shorten", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${currentKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    url: "https://myapp.com/documentation",
    customAlias: "my-doc",
    stripTracking: true
  })
});
const data = await response.json();
console.log(data.shortUrl);`,

    python: `import requests

url = "${currentHost}/api/v1/shorten"
headers = {
    "Authorization": "Bearer ${currentKey}",
    "Content-Type": "application/json"
}
payload = {
    "url": "https://myapp.com/documentation",
    "customAlias": "my-doc",
    "stripTracking": True
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="brand-icon-box" style={{ width: '32px', height: '32px' }}>
              <Key size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                Developer API Keys
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                Automate Qvlink tools in your personal or commercial projects
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* API Key Box */}
        <div className="api-key-box" style={{ margin: '16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Live Production Key
            </span>
            <span className="retention-chip" style={{ fontSize: '0.72rem' }}>
              ⚡ Unlimited Tier
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="input-text no-icon input-mono" style={{ flex: 1, fontSize: '0.86rem', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
              {showKey ? currentKey : maskedKey}
            </div>

            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyKey}
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              className="btn btn-danger-outline btn-sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              title="Regenerate API key"
            >
              <RefreshCw size={13} className={regenerating ? 'spin-anim' : ''} />
              <span>Roll</span>
            </button>
          </div>
        </div>

        {/* Code Snippets Section */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
              <Code2 size={15} color="var(--primary-accent)" />
              <span>Quick Integration Example</span>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {['curl', 'js', 'python'].map((tab) => (
                <button
                  key={tab}
                  className={`btn btn-sm ${selectedSnippetTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 8px', fontSize: '0.75rem', textTransform: 'uppercase' }}
                  onClick={() => setSelectedSnippetTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <pre className="code-snippet-box">
              <code>{codeSnippets[selectedSnippetTab]}</code>
            </pre>
            <button
              type="button"
              className="btn btn-sm btn-secondary copy-snippet-btn"
              onClick={() => {
                navigator.clipboard.writeText(codeSnippets[selectedSnippetTab]);
                showToast('Snippet copied', 'success');
              }}
            >
              <Copy size={12} />
              <span>Copy</span>
            </button>
          </div>
        </div>

        {/* In-App Interactive API Sandbox */}
        <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={15} color="var(--primary-accent)" />
            <span>Interactive API Sandbox</span>
          </div>

          <form onSubmit={handleRunTest} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              className="input-text no-icon"
              style={{ flex: 1, fontSize: '0.86rem' }}
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="Destination URL..."
              required
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={testing}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Send size={13} />
              <span>{testing ? 'Testing...' : 'Test Request'}</span>
            </button>
          </form>

          {testResult && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: testResult.status === 201 ? 'var(--success)' : 'var(--danger)', marginBottom: '4px' }}>
                HTTP Status: {testResult.status} {testResult.message || 'Error'}
              </div>
              <pre className="code-snippet-box" style={{ maxHeight: '140px', margin: 0 }}>
                <code>{JSON.stringify(testResult, null, 2)}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
