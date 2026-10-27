import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'qvlink-dev-server-apis',
        configureServer(server) {
          const supabaseUrl = env.VITE_SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
          const serviceKey = env.VITE_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;
          const activeKey = serviceKey || env.VITE_SUPABASE_ANON_KEY;
          const admin = createClient(supabaseUrl, activeKey);
          const bucket = env.VITE_SUPABASE_BUCKET || 'qivlink_store';

          const fetchJson = async (filename) => {
            try {
              const { data } = await admin.storage.from(bucket).download(filename);
              if (!data) return [];
              const parsed = JSON.parse(await data.text());
              return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              return [];
            }
          };

          const saveJson = async (filename, list) => {
            try {
              const buf = Buffer.from(JSON.stringify(list, null, 2), 'utf8');
              await admin.storage.from(bucket).upload(filename, buf, {
                upsert: true,
                contentType: 'application/json'
              });
              return true;
            } catch (e) {
              return false;
            }
          };

          // 1. Direct Google OAuth Endpoint
          server.middlewares.use('/api/auth/google', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { code, credential, redirect_uri } = JSON.parse(body || '{}');
                const googleClientId = env.VITE_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID;
                const googleClientSecret = env.GOOGLE_CLIENT_SECRET || env.VITE_GOOGLE_CLIENT_SECRET;

                let googleProfile = null;

                if (credential && typeof credential === 'string') {
                  const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
                  if (verifyRes.ok) {
                    const tokenInfo = await verifyRes.json();
                    if (tokenInfo.aud === googleClientId && tokenInfo.email) {
                      googleProfile = {
                        email: tokenInfo.email.toLowerCase(),
                        name: tokenInfo.name || tokenInfo.email.split('@')[0],
                        picture: tokenInfo.picture || '',
                        sub: tokenInfo.sub
                      };
                    }
                  }
                }

                if (!googleProfile && code) {
                  const exchangeRedirectUri = redirect_uri || 'postmessage';

                  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                      code,
                      client_id: googleClientId,
                      client_secret: googleClientSecret,
                      redirect_uri: exchangeRedirectUri,
                      grant_type: 'authorization_code'
                    })
                  });

                  const tokenData = await tokenRes.json();
                  if (tokenData.id_token) {
                    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`);
                    if (verifyRes.ok) {
                      const tokenInfo = await verifyRes.json();
                      if (tokenInfo.aud === googleClientId && tokenInfo.email) {
                        googleProfile = {
                          email: tokenInfo.email.toLowerCase(),
                          name: tokenInfo.name || tokenInfo.email.split('@')[0],
                          picture: tokenInfo.picture || '',
                          sub: tokenInfo.sub
                        };
                      }
                    }
                  }

                  if (!googleProfile && tokenData.access_token) {
                    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                      headers: { Authorization: `Bearer ${tokenData.access_token}` }
                    });
                    if (userInfoRes.ok) {
                      const info = await userInfoRes.json();
                      if (info.email) {
                        googleProfile = {
                          email: info.email.toLowerCase(),
                          name: info.name || info.email.split('@')[0],
                          picture: info.picture || '',
                          sub: info.sub
                        };
                      }
                    }
                  }
                }

                if (!googleProfile?.email) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Could not extract Google profile' }));
                  return;
                }

                let authedUser = null;
                if (serviceKey) {
                  const { data: list } = await admin.auth.admin.listUsers();
                  let existing = list?.users?.find(u => u.email?.toLowerCase() === googleProfile.email);

                  if (!existing) {
                    const { data: created } = await admin.auth.admin.createUser({
                      email: googleProfile.email,
                      password: 'GoogleUser_' + Math.random().toString(36).substring(2, 10) + '!2026',
                      email_confirm: true,
                      user_metadata: {
                        name: googleProfile.name,
                        picture: googleProfile.picture,
                        provider: 'google'
                      }
                    });
                    if (created?.user) existing = created.user;
                  }

                  authedUser = existing;
                }

                if (!authedUser) {
                  authedUser = {
                    id: 'g_' + (googleProfile.sub || Math.random().toString(36).substring(2, 10)),
                    email: googleProfile.email,
                    user_metadata: {
                      name: googleProfile.name,
                      picture: googleProfile.picture,
                      provider: 'google'
                    }
                  };
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, user: authedUser }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          });

          // 2. Register User
          server.middlewares.use('/api/auth/register-user', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { email, password } = JSON.parse(body || '{}');
                if (!serviceKey) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, fallback: true }));
                  return;
                }

                const cleanEmail = (email || '').trim().toLowerCase();
                const { data, error } = await admin.auth.admin.createUser({
                  email: cleanEmail,
                  password,
                  email_confirm: true
                });

                if (error) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: error.message }));
                  return;
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, user: data.user }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          });

          // 3. Confirm User
          server.middlewares.use('/api/auth/confirm-user', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { email, userId } = JSON.parse(body || '{}');
                if (!serviceKey) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, message: 'No service key configured' }));
                  return;
                }

                let targetId = userId;
                if (!targetId && email) {
                  const { data } = await admin.auth.admin.listUsers();
                  const found = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
                  if (found) targetId = found.id;
                }

                if (targetId) {
                  await admin.auth.admin.updateUserById(targetId, { email_confirm: true });
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, confirmed: true }));
                } else {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, message: 'User not found to confirm' }));
                }
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          });

          // 4. Quick Share Dev API (GET & POST)
          server.middlewares.use('/api/share', async (req, res) => {
            // GET
            if (req.method === 'GET') {
              const urlObj = new URL(req.url, 'http://localhost:3000');
              const pinQuery = urlObj.searchParams.get('pin') || urlObj.searchParams.get('code') || urlObj.searchParams.get('id');
              if (!pinQuery) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'PIN is required' }));
                return;
              }

              const clean = String(pinQuery).trim().replace(/[\s-]/g, '').toUpperCase();
              const list = await fetchJson('transfers.json');
              const now = Date.now();
              const found = list.find(t => {
                const p = String(t.pin || t.pickupCode || '').trim().replace(/[\s-]/g, '').toUpperCase();
                const id = String(t.id || '').trim().toUpperCase();
                return p === clean || id === clean;
              });

              if (!found || (now - (found.createdAt || 0) > 7 * 24 * 3600 * 1000)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Share not found or expired.' }));
                return;
              }

              found.views = (found.views || 0) + 1;
              saveJson('transfers.json', list).catch(() => {});

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                share: {
                  id: found.id,
                  pin: found.pin || found.pickupCode,
                  content: found.content,
                  title: found.title,
                  type: found.type || (found.content.startsWith('http') ? 'link' : 'text'),
                  createdAt: found.createdAt,
                  views: found.views
                }
              }));
              return;
            }

            // POST
            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { content, title, type, deviceToken } = JSON.parse(body || '{}');
                  if (!content || !String(content).trim()) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: 'Content required' }));
                    return;
                  }

                  const list = await fetchJson('transfers.json');
                  const now = Date.now();
                  const active = list.filter(t => now - (t.createdAt || 0) <= 7 * 24 * 3600 * 1000);
                  const pin = String(Math.floor(100000 + Math.random() * 900000));

                  const item = {
                    id: 'sh_' + Math.random().toString(36).substring(2, 9) + '_' + now,
                    pin,
                    content: String(content).trim().slice(0, 50000),
                    title: (title || '').trim().slice(0, 100) || (content.startsWith('http') ? 'Shared Link' : 'Shared Note'),
                    type: type || (content.startsWith('http') ? 'link' : 'text'),
                    creatorDevice: (deviceToken || '').trim(),
                    createdAt: now,
                    views: 0
                  };

                  await saveJson('transfers.json', [item, ...active]);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, share: item }));
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: err.message }));
                }
              });
              return;
            }

            res.statusCode = 405;
            res.end();
          });

          // 5. Links API (GET, POST, DELETE)
          server.middlewares.use('/api/links', async (req, res) => {
            if (req.method === 'GET') {
              const urlObj = new URL(req.url, 'http://localhost:3000');
              const code = urlObj.searchParams.get('code');
              const list = await fetchJson('links.json');
              const now = Date.now();
              const active = list.filter(l => now - (l.createdAt || 0) <= 7 * 24 * 3600 * 1000);

              if (code) {
                const clean = String(code).trim().toLowerCase();
                const found = active.find(l => String(l.shortCode || '').trim().toLowerCase() === clean);
                if (!found) {
                  res.statusCode = 404;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'Link not found' }));
                  return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, link: found }));
                return;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, links: active }));
              return;
            }

            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { link } = JSON.parse(body || '{}');
                  if (!link || !link.shortCode || !link.targetUrl) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Invalid link' }));
                    return;
                  }

                  const list = await fetchJson('links.json');
                  const now = Date.now();
                  const active = list.filter(l => now - (l.createdAt || 0) <= 7 * 24 * 3600 * 1000);
                  const clean = String(link.shortCode).trim().toLowerCase();

                  const updated = [link, ...active.filter(l => l.id !== link.id && l.shortCode !== clean)];
                  await saveJson('links.json', updated);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, link }));
                } catch (e) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: e.message }));
                }
              });
              return;
            }

            res.statusCode = 405;
            res.end();
          });

          // 6. Direct Quick Share Note Dev Route (e.g. /s/873936)
          server.middlewares.use(async (req, res, next) => {
            if (req.method !== 'GET') return next();
            const pathOnly = req.url.split('?')[0];
            const sMatch = pathOnly.match(/^\/s\/([a-zA-Z0-9_-]+)$/);
            if (sMatch) {
              const pin = sMatch[1].replace(/[\s-]/g, '').toUpperCase();
              try {
                const list = await fetchJson('transfers.json');
                const now = Date.now();
                const found = list.find(t => {
                  const p = String(t.pin || t.pickupCode || '').trim().replace(/[\s-]/g, '').toUpperCase();
                  const id = String(t.id || '').trim().toUpperCase();
                  return p === pin || id === pin;
                });
                if (found && now - (found.createdAt || 0) <= 7 * 24 * 3600 * 1000) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'text/html; charset=utf-8');
                  res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Shared Note — Qvlink</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:30px 16px;background:#090d16;color:#f8fafc;display:flex;justify-content:center;min-height:100vh;align-items:center;margin:0}div.card{max-width:520px;width:100%;background:#111827;padding:28px;border-radius:16px;border:1px solid rgba(255,255,255,0.12);box-shadow:0 20px 40px rgba(0,0,0,0.4)}pre{background:#0b0f19;padding:16px;border-radius:10px;white-space:pre-wrap;font-family:monospace;font-size:0.9rem;border:1px solid #1f2937}button,a{display:inline-block;padding:10px 18px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-radius:8px;text-decoration:none;border:none;cursor:pointer;font-weight:700;margin-top:10px;font-size:0.86rem}</style></head><body><div class="card"><div style="font-size:0.8rem;color:#3b82f6;font-weight:700">PIN: ${pin}</div><h2 style="margin:8px 0 14px">${found.title || 'Shared Note'}</h2><pre id="c">${found.content}</pre><div style="display:flex;gap:10px"><button onclick="navigator.clipboard.writeText(document.getElementById('c').innerText);this.innerText='Copied! ✓'">Copy Note</button><a href="/?tab=sharing" style="background:#1f2937;border:1px solid #374151">Open Qvlink</a></div></div></body></html>`);
                  return;
                }
              } catch (e) {}
            }
            next();
          });

          // 7. Direct Short Code HTTP 302 Redirect (e.g. http://localhost:3000/pfde9w)
          server.middlewares.use(async (req, res, next) => {
            if (req.method !== 'GET') return next();

            const pathOnly = req.url.split('?')[0];
            const match = pathOnly.match(/^\/([a-zA-Z0-9_-]{3,64})$/);
            if (!match) return next();

            const code = match[1].toLowerCase();
            const reserved = ['src', 'node_modules', 'api', 'assets', 'favicon', 'shorten', 'qr', 'paste', 'files', 'sharing', 'history', 's', 'p'];
            if (reserved.includes(code)) return next();

            try {
              const list = await fetchJson('links.json');
              const now = Date.now();
              const found = list.find(l => {
                if (!l || !l.shortCode) return false;
                if (now - (l.createdAt || 0) > 7 * 24 * 3600 * 1000) return false;
                return String(l.shortCode).trim().toLowerCase() === code;
              });

              if (found && found.targetUrl) {
                let target = found.targetUrl.trim();
                if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
                res.writeHead(302, { Location: target, 'Cache-Control': 'no-cache' });
                res.end();
                return;
              }
            } catch (e) {}

            next();
          });
        }
      }
    ],
    server: {
      port: 3000,
      host: true
    }
  };
});
