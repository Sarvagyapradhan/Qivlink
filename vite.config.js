import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'qvlink-auth-dev-api',
        configureServer(server) {
          // Direct Google OAuth (No Supabase intermediary on Google prompt)
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
                const { code, credential, redirect_uri, client_id, client_secret } = JSON.parse(body || '{}');
                const supabaseUrl = env.VITE_SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
                const serviceKey = env.VITE_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;
                const googleClientId = client_id || env.VITE_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID;
                const googleClientSecret = client_secret || env.GOOGLE_CLIENT_SECRET || env.VITE_GOOGLE_CLIENT_SECRET;

                let googleProfile = null;

                if (credential) {
                  const parts = credential.split('.');
                  if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                    if (payload.email) {
                      googleProfile = {
                        email: payload.email.toLowerCase(),
                        name: payload.name || payload.email.split('@')[0],
                        picture: payload.picture || '',
                        sub: payload.sub
                      };
                    }
                  }
                }

                if (!googleProfile && code) {
                  if (!googleClientId || !googleClientSecret) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Google Client ID or Client Secret not configured. Please enter them in settings or add VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local.' }));
                    return;
                  }

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
                    const parts = tokenData.id_token.split('.');
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                    googleProfile = {
                      email: payload.email.toLowerCase(),
                      name: payload.name || payload.email.split('@')[0],
                      picture: payload.picture || '',
                      sub: payload.sub
                    };
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
                  const admin = createClient(supabaseUrl, serviceKey);
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

          // Register User (bypasses email send rate limit by auto-confirming email)
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
                const supabaseUrl = env.VITE_SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
                const serviceKey = env.VITE_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;

                if (!serviceKey) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, fallback: true }));
                  return;
                }

                const admin = createClient(supabaseUrl, serviceKey);
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

          // Confirm User
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
                const supabaseUrl = env.VITE_SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
                const serviceKey = env.VITE_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;

                if (!serviceKey) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, message: 'No service key configured' }));
                  return;
                }

                const admin = createClient(supabaseUrl, serviceKey);

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
        }
      }
    ],
    server: {
      port: 3000,
      host: true
    }
  };
});
