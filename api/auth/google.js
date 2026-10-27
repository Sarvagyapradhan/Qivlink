import { createClient } from '@supabase/supabase-js';

// Simple in-memory rate limiter to prevent brute force abuse
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now - record.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  record.count += 1;
  return false;
}

/**
 * Hardened Direct Google OAuth Token Verification & Exchange
 * Cryptographically validates tokens via Google tokeninfo/oauth2 endpoints.
 * Completely eliminates any external mediator or unverified JWT claims.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.socket?.remoteAddress || 
                   'unknown';

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Too many authentication attempts. Please try again shortly.' });
  }

  try {
    const { code, credential, redirect_uri } = req.body || {};
    
    // Server-enforced Google credentials from environment variables
    const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID || 
                           process.env.GOOGLE_CLIENT_ID;

    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 
                               process.env.VITE_GOOGLE_CLIENT_SECRET;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

    let googleProfile = null;

    // 1. If ID Token (credential) is passed: Cryptographically verify via Google's tokeninfo API
    if (credential && typeof credential === 'string') {
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!verifyRes.ok) {
        return res.status(401).json({ error: 'Invalid Google identity token.' });
      }
      
      const tokenInfo = await verifyRes.json();
      
      // Strict audience and email verification checks
      if (tokenInfo.aud !== googleClientId) {
        return res.status(401).json({ error: 'Token audience does not match this application.' });
      }

      if (!tokenInfo.email || (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true)) {
        return res.status(401).json({ error: 'Google email is not verified.' });
      }

      googleProfile = {
        email: tokenInfo.email.toLowerCase(),
        name: tokenInfo.name || tokenInfo.email.split('@')[0],
        picture: tokenInfo.picture || '',
        sub: tokenInfo.sub
      };
    }

    // 2. If Authorization Code is passed: Exchange securely with Google OAuth 2.0 token endpoint
    if (!googleProfile && code) {
      // Validate redirect_uri to prevent open-redirect or parameter manipulation
      let safeRedirectUri = 'postmessage';
      if (redirect_uri && typeof redirect_uri === 'string') {
        const allowedOrigins = ['http://localhost:3000', 'https://qvlink.vercel.app'];
        const isAllowed = allowedOrigins.some(origin => redirect_uri.startsWith(origin)) || redirect_uri === 'postmessage';
        if (isAllowed) {
          safeRedirectUri = redirect_uri;
        }
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: safeRedirectUri,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || tokenData.error) {
        return res.status(400).json({ 
          error: tokenData.error_description || tokenData.error || 'Google authorization code exchange failed.' 
        });
      }

      // Verify returned ID token with Google's tokeninfo service
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

      // Fallback to Google userinfo endpoint using access token
      if (!googleProfile && tokenData.access_token) {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        if (userInfoRes.ok) {
          const info = await userInfoRes.json();
          if (info.email && info.email_verified) {
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

    if (!googleProfile || !googleProfile.email) {
      return res.status(401).json({ error: 'Could not obtain a verified Google profile.' });
    }

    // 3. User account sync & database authorization
    let authedUser = null;
    if (serviceKey) {
      try {
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: list } = await admin.auth.admin.listUsers();
        let existing = list?.users?.find(u => u.email?.toLowerCase() === googleProfile.email);

        if (!existing) {
          const randomSecret = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          const { data: created } = await admin.auth.admin.createUser({
            email: googleProfile.email,
            password: `G_${randomSecret}_!2026`,
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
        console.warn('Database account sync notice:', dbErr.message);
      }
    }

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
      user: {
        id: authedUser.id,
        email: authedUser.email,
        user_metadata: authedUser.user_metadata || {
          name: googleProfile.name,
          picture: googleProfile.picture,
          provider: 'google'
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal authentication error: ' + err.message });
  }
}
