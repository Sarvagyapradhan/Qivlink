import { createClient } from '@supabase/supabase-js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqanZvYnF3bm5senhzb3Zqb3Z4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzAzMTM4NiwiZXhwIjoyMTA4NjA3Mzg2fQ.PCmiPn9GgytKy5i51zTzXZxYFjoDCqt9JmZLd9dC1tM';

function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || FALLBACK_SERVICE_KEY;
  return createClient(supabaseUrl, serviceKey);
}

const BUCKET = process.env.VITE_SUPABASE_BUCKET || 'qivlink_store';

function sanitizeUrl(rawUrl, stripTracking = true) {
  try {
    const parsed = new URL(rawUrl);
    if (stripTracking) {
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'mc_eid', '_ga', '_gl', 'ref', 'source'
      ];
      trackingParams.forEach(p => parsed.searchParams.delete(p));
    }
    return parsed.toString();
  } catch (e) {
    return rawUrl;
  }
}

function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  // 1. Validate API Key
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!apiKey || !apiKey.startsWith('qvl_live_')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing API key. Provide Authorization: Bearer qvl_live_...'
    });
  }

  const { url, customAlias, stripTracking = true, title = '' } = req.body || {};
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL: Please provide a valid http or https URL.'
    });
  }

  const targetUrl = sanitizeUrl(url.trim(), stripTracking !== false);
  const supabase = getSupabaseClient();
  const now = Date.now();

  try {
    // Fetch active links
    let links = [];
    try {
      const { data } = await supabase.storage.from(BUCKET).download('links.json');
      if (data) {
        const text = await data.text();
        const list = JSON.parse(text);
        if (Array.isArray(list)) {
          links = list.filter(l => now - (l.createdAt || 0) <= SEVEN_DAYS_MS);
        }
      }
    } catch (_) {}

    // Handle code/alias
    let shortCode = '';
    if (customAlias && typeof customAlias === 'string') {
      const cleanAlias = customAlias.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
      if (cleanAlias.length < 3) {
        return res.status(400).json({ success: false, error: 'Custom alias must be at least 3 characters long.' });
      }
      const collision = links.find(l => l.shortCode === cleanAlias);
      if (collision) {
        return res.status(409).json({ success: false, error: 'Custom alias is already in use.' });
      }
      shortCode = cleanAlias;
    } else {
      let candidate = generateShortCode(6);
      while (links.some(l => l.shortCode === candidate)) {
        candidate = generateShortCode(6);
      }
      shortCode = candidate;
    }

    const host = 'https://qvlink.vercel.app';
    const shortUrl = `${host}/${shortCode}`;
    const id = `link_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const newLink = {
      id,
      shortCode,
      targetUrl,
      title: title || shortCode,
      createdAt: now,
      expiresAt: now + SEVEN_DAYS_MS,
      clicks: 0,
      apiKeyPrefix: apiKey.slice(0, 14),
      retention: '7 days'
    };

    const updatedLinks = [newLink, ...links];
    const payload = JSON.stringify(updatedLinks, null, 2);
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload('links.json', Buffer.from(payload, 'utf8'), {
      upsert: true,
      contentType: 'application/json',
      cacheControl: '0'
    });

    if (uploadError) {
      console.error('Supabase upload error in v1/shorten.js:', uploadError);
      return res.status(500).json({ success: false, error: 'Storage upload failed: ' + uploadError.message });
    }

    return res.status(201).json({
      success: true,
      id,
      shortCode,
      shortUrl,
      targetUrl,
      qrCode: shortUrl,
      retention: '7 days',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SEVEN_DAYS_MS).toISOString()
    });

  } catch (err) {
    console.error('API shorten error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}
