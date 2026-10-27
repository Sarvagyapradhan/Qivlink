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
      port: 5173,
      host: true
    }
  };
});
