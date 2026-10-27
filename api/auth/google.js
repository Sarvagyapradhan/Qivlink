import { createClient } from '@supabase/supabase-js';

/**
 * Direct Google OAuth Token Exchange Endpoint
 * Bypasses Supabase intermediary domain completely.
 * Exchanges Google authorization code using Google Client ID & Client Secret directly with Google OAuth 2.0.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, credential, redirect_uri, client_id, client_secret } = req.body || {};
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;
    const googleClientId = client_id || process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = client_secret || process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET;

    let googleProfile = null;

    // 1. If an ID Token (credential) is passed directly from Google Identity Services
    if (credential) {
      try {
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
      } catch (jwtErr) {
        console.warn('JWT parse notice:', jwtErr);
      }
    }

    // 2. If an authorization code is passed, exchange directly with Google using client secret
    if (!googleProfile && code) {
      if (!googleClientId || !googleClientSecret) {
        return res.status(400).json({ 
          error: 'Google Client ID or Client Secret not configured. Please enter them in settings or add VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.' 
        });
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
      } else if (tokenData.access_token) {
        // Fetch userinfo using access_token
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const info = await userinfoRes.json();
        googleProfile = {
          email: info.email.toLowerCase(),
          name: info.name || info.email.split('@')[0],
          picture: info.picture || '',
          sub: info.sub
        };
      } else {
        return res.status(400).json({ 
          error: tokenData.error_description || tokenData.error || 'Failed to exchange authorization code with Google' 
        });
      }
    }

    if (!googleProfile || !googleProfile.email) {
      return res.status(400).json({ error: 'Could not retrieve verified Google profile.' });
    }

    // 3. Synchronize with database so user account has full Unlimited privileges and API key access
    let authedUser = null;
    if (serviceKey) {
      try {
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: list } = await admin.auth.admin.listUsers();
        let existing = list?.users?.find(u => u.email?.toLowerCase() === googleProfile.email);

        if (!existing) {
          const { data: created } = await admin.auth.admin.createUser({
            email: googleProfile.email,
            password: 'GUser_' + Math.random().toString(36).substring(2, 12) + '!#2026',
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
      } catch (dbErr) {
        console.warn('Database user sync notice:', dbErr);
      }
    }

    // Fallback safe user object
    if (!authedUser) {
      authedUser = {
        id: 'g_' + (googleProfile.sub || Math.random().toString(36).substring(2, 12)),
        email: googleProfile.email,
        user_metadata: {
          name: googleProfile.name,
          picture: googleProfile.picture,
          provider: 'google'
        }
      };
    }

    return res.status(200).json({
      success: true,
      user: authedUser,
      googleProfile
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal OAuth error' });
  }
}
