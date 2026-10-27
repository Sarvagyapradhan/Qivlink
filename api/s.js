import { createClient } from '@supabase/supabase-js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqanZvYnF3bm5senhzb3Zqb3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzEzODYsImV4cCI6MjEwODYwNzM4Nn0.pRcHOLffia7XJ1PjR9PeIYTM4P7cvQ2SjFA2RBhyvtk';

function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;
  const activeKey = serviceKey || anonKey;
  return createClient(supabaseUrl, activeKey);
}

const BUCKET = process.env.VITE_SUPABASE_BUCKET || 'qivlink_store';

async function fetchTransfers(supabase) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download('transfers.json');
    if (error || !data) return [];
    const text = await data.text();
    const list = JSON.parse(text);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderNoteHtml(found, cleanPin) {
  const isLink = found.type === 'link' || found.content.startsWith('http://') || found.content.startsWith('https://');
  const safeContent = escapeHtml(found.content);
  const formattedPin = cleanPin.length === 6 ? `${cleanPin.slice(0, 3)} ${cleanPin.slice(3)}` : cleanPin;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(found.title || (isLink ? 'Shared Link' : 'Shared Note'))} — Qvlink</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card: rgba(17, 24, 39, 0.94);
      --border: rgba(255, 255, 255, 0.14);
      --text: #f8fafc;
      --text-sub: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --box-bg: #0f172a;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --card: rgba(255, 255, 255, 0.96);
        --border: rgba(226, 232, 240, 0.95);
        --text: #0f172a;
        --text-sub: #64748b;
        --primary: #2563eb;
        --primary-hover: #1d4ed8;
        --box-bg: #f1f5f9;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .header-bar {
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--text);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .brand-icon {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 14px;
      font-weight: 800;
    }
    .card {
      background: var(--card);
      border: 1.5px solid var(--border);
      border-radius: 18px;
      padding: 28px;
      max-width: 540px;
      width: 100%;
      box-shadow: 0 20px 45px rgba(0,0,0,0.22);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .top-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pin-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.92rem;
      font-weight: 700;
      background: rgba(37, 99, 235, 0.14);
      color: var(--primary);
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid rgba(37, 99, 235, 0.28);
    }
    .type-badge {
      font-size: 0.78rem;
      color: var(--text-sub);
      font-weight: 600;
    }
    .title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 14px;
      word-break: break-word;
    }
    .content-box {
      background: var(--box-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.92rem;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 380px;
      overflow-y: auto;
      margin-bottom: 20px;
    }
    .content-box a {
      color: var(--primary);
      text-decoration: underline;
    }
    .btn-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn {
      flex: 1;
      min-width: 130px;
      padding: 12px 18px;
      font-size: 0.88rem;
      font-weight: 700;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-decoration: none;
      transition: all 0.18s ease;
      font-family: inherit;
    }
    .btn-primary {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #1d4ed8, #1e40af);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: var(--box-bg);
      color: var(--text);
      border: 1.5px solid var(--border);
    }
    .btn-secondary:hover {
      border-color: var(--primary);
      color: var(--primary);
      transform: translateY(-1px);
    }
    .footer-note {
      text-align: center;
      font-size: 0.78rem;
      color: var(--text-sub);
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <a href="/" class="brand">
      <span class="brand-icon">Q</span>
      <span>Qvlink Quick Share</span>
    </a>
  </div>

  <div class="card">
    <div class="top-meta">
      <span class="pin-badge">PIN: ${escapeHtml(formattedPin)}</span>
      <span class="type-badge">${isLink ? '🔗 Shared Link' : '📝 Shared Note'} • 7-day retention</span>
    </div>

    <h1 class="title">${escapeHtml(found.title || (isLink ? 'Shared Link' : 'Shared Note'))}</h1>

    <div class="content-box" id="content-container">
      ${isLink ? `<a href="${safeContent}" target="_blank" rel="noopener noreferrer">${safeContent}</a>` : safeContent}
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" id="copy-btn" onclick="copyContent()">
        <span>Copy Note</span>
      </button>

      ${isLink ? `
      <a href="${safeContent}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
        <span>Open Link ↗</span>
      </a>` : ''}

      <a href="/?tab=sharing" class="btn btn-secondary">
        <span>Create Share</span>
      </a>
    </div>
  </div>

  <div class="footer-note">
    End-to-end zero tracking • Shared via Qvlink
  </div>

  <script>
    const rawContent = ${JSON.stringify(found.content)};
    function copyContent() {
      navigator.clipboard.writeText(rawContent).then(() => {
        const btn = document.getElementById('copy-btn');
        btn.innerHTML = '<span>Copied! ✓</span>';
        setTimeout(() => {
          btn.innerHTML = '<span>Copy Note</span>';
        }, 2200);
      });
    }
  </script>
</body>
</html>`;
}

function renderLivePollingHtml(cleanPin) {
  const formattedPin = cleanPin.length === 6 ? `${cleanPin.slice(0, 3)} ${cleanPin.slice(3)}` : cleanPin;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Locating Note (${escapeHtml(formattedPin)}) — Qvlink</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card: rgba(17, 24, 39, 0.94);
      --border: rgba(255, 255, 255, 0.14);
      --text: #f8fafc;
      --text-sub: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --box-bg: #0f172a;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --card: rgba(255, 255, 255, 0.96);
        --border: rgba(226, 232, 240, 0.95);
        --text: #0f172a;
        --text-sub: #64748b;
        --primary: #2563eb;
        --primary-hover: #1d4ed8;
        --box-bg: #f1f5f9;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .header-bar {
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--text);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .brand-icon {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 14px;
      font-weight: 800;
    }
    .card {
      background: var(--card);
      border: 1.5px solid var(--border);
      border-radius: 18px;
      padding: 32px 28px;
      max-width: 500px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 45px rgba(0,0,0,0.25);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3.5px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 0.9rem;
      color: var(--text-sub);
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .pin-display {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.3rem;
      font-weight: 800;
      letter-spacing: 2px;
      color: var(--primary);
      background: rgba(37, 99, 235, 0.1);
      padding: 8px 18px;
      border-radius: 10px;
      display: inline-block;
      margin-bottom: 20px;
      border: 1px solid rgba(37, 99, 235, 0.25);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      font-size: 0.9rem;
      font-weight: 700;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.18s ease;
      font-family: inherit;
    }
    .btn-primary {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
      width: 100%;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #1d4ed8, #1e40af);
      transform: translateY(-1px);
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="header-bar">
    <a href="/" class="brand">
      <span class="brand-icon">Q</span>
      <span>Qvlink Quick Share</span>
    </a>
  </div>

  <div class="card" id="main-card">
    <div id="loading-state">
      <div class="spinner"></div>
      <div class="pin-display">PIN: ${escapeHtml(formattedPin)}</div>
      <h1 class="title">Connecting to Shared Note...</h1>
      <p class="subtitle" id="status-text">Synchronizing latest share data across devices</p>
    </div>

    <div id="notfound-state" class="hidden">
      <div style="font-size: 42px; margin-bottom: 16px;">🔍</div>
      <div class="pin-display">PIN: ${escapeHtml(formattedPin)}</div>
      <h1 class="title">Note Not Found or Expired</h1>
      <p class="subtitle">No active note was found for this PIN. It may have expired (7-day lifecycle) or been removed by the sender.</p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-primary" onclick="retryCheck()" style="flex: 1;">Check Again</button>
        <a href="/?tab=sharing" class="btn" style="flex: 1; background: var(--box-bg); color: var(--text); border: 1.5px solid var(--border);">Share a Note</a>
      </div>
    </div>
  </div>

  <script>
    const cleanPin = ${JSON.stringify(cleanPin)};
    let attempts = 0;
    const maxAttempts = 5;

    async function pollShare() {
      attempts++;
      const statusEl = document.getElementById('status-text');
      if (statusEl && attempts > 1) {
        statusEl.textContent = 'Searching cloud store... (attempt ' + attempts + ' of ' + maxAttempts + ')';
      }

      try {
        const res = await fetch('/api/share?pin=' + encodeURIComponent(cleanPin) + '&_t=' + Date.now(), {
          cache: 'no-store'
        });
        const data = await res.json();
        if (res.ok && data.success && data.share) {
          // Note retrieved successfully! Refresh the page to render complete server-side HTML
          window.location.reload();
          return;
        }
      } catch (err) {}

      if (attempts < maxAttempts) {
        setTimeout(pollShare, 650);
      } else {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('notfound-state').classList.remove('hidden');
      }
    }

    function retryCheck() {
      attempts = 0;
      document.getElementById('notfound-state').classList.add('hidden');
      document.getElementById('loading-state').classList.remove('hidden');
      pollShare();
    }

    // Start polling immediately
    setTimeout(pollShare, 250);
  </script>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const rawPin = req.query.pin || req.query.code || req.query.id || '';
  const cleanPin = String(rawPin).trim().replace(/[\s-]/g, '').toUpperCase();

  if (!cleanPin) {
    res.writeHead(302, { Location: '/?tab=sharing' });
    return res.end();
  }

  const supabase = getSupabaseClient();
  let transfers = await fetchTransfers(supabase);
  const now = Date.now();

  let found = transfers.find(t => {
    const tPin = String(t.pin || t.pickupCode || '').trim().replace(/[\s-]/g, '').toUpperCase();
    const tId = String(t.id || '').trim().toUpperCase();
    return tPin === cleanPin || tId === cleanPin;
  });

  // Server-side retry: wait 450ms and check again in case cloud upload is just finishing
  if (!found) {
    await new Promise(r => setTimeout(r, 450));
    transfers = await fetchTransfers(supabase);
    found = transfers.find(t => {
      const tPin = String(t.pin || t.pickupCode || '').trim().replace(/[\s-]/g, '').toUpperCase();
      const tId = String(t.id || '').trim().toUpperCase();
      return tPin === cleanPin || tId === cleanPin;
    });
  }

  // Found and active: Render full note HTML immediately
  if (found && (now - (found.createdAt || 0) <= SEVEN_DAYS_MS)) {
    return res.status(200).send(renderNoteHtml(found, cleanPin));
  }

  // Not found yet or newly created: Render live polling HTML to catch in-flight shares smoothly
  return res.status(200).send(renderLivePollingHtml(cleanPin));
}
