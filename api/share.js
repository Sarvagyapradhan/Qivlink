import { createClient } from '@supabase/supabase-js';

// IP-based Rate Limiter to protect against PIN brute-forcing
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 40;

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now - record.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return true;
  }
  record.count += 1;
  return false;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
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

async function saveTransfers(supabase, list) {
  try {
    const payload = JSON.stringify(list, null, 2);
    const blob = Buffer.from(payload, 'utf8');
    await supabase.storage.from(BUCKET).upload('transfers.json', blob, {
      upsert: true,
      contentType: 'application/json'
    });
    return true;
  } catch (e) {
    console.warn('Transfers write notice:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.socket?.remoteAddress || 
                   'unknown';

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please wait a moment.' });
  }

  const supabase = getSupabaseClient();

  // GET: Retrieve a transfer by 6-digit PIN or ID
  if (req.method === 'GET') {
    try {
      const pinQuery = req.query.pin || req.query.code || req.query.id;
      if (!pinQuery) {
        return res.status(400).json({ success: false, error: 'PIN or code is required.' });
      }

      const cleanPin = String(pinQuery).trim().replace(/[\s-]/g, '').toUpperCase();
      const transfers = await fetchTransfers(supabase);
      const now = Date.now();

      const found = transfers.find(t => {
        const tPin = String(t.pin || t.pickupCode || '').trim().replace(/[\s-]/g, '').toUpperCase();
        const tId = String(t.id || '').trim().toUpperCase();
        return tPin === cleanPin || tId === cleanPin;
      });

      if (!found) {
        return res.status(404).json({ success: false, error: 'No active share found with this code. It may have expired.' });
      }

      if (now - (found.createdAt || 0) > SEVEN_DAYS_MS) {
        return res.status(410).json({ success: false, error: 'This share has expired (7-day retention limit reached).' });
      }

      // Track view count
      found.views = (found.views || 0) + 1;
      saveTransfers(supabase, transfers).catch(() => {});

      return res.status(200).json({
        success: true,
        share: {
          id: found.id,
          pin: found.pin || found.pickupCode,
          content: found.content,
          title: found.title,
          type: found.type || (found.content.startsWith('http') ? 'link' : 'text'),
          createdAt: found.createdAt,
          expiresAt: found.createdAt + SEVEN_DAYS_MS,
          views: found.views
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST: Create a new share with an instant 6-digit PIN
  if (req.method === 'POST') {
    try {
      const { content, title, type, deviceToken, userId, email } = req.body || {};

      if (!content || !String(content).trim()) {
        return res.status(400).json({ success: false, error: 'Content is required to share.' });
      }

      const trimmedContent = String(content).trim().slice(0, 50000); // 50KB max safe payload
      const transfers = await fetchTransfers(supabase);
      const now = Date.now();

      // Clean expired transfers (older than 7 days)
      const active = transfers.filter(t => now - (t.createdAt || 0) <= SEVEN_DAYS_MS);

      // Generate a friendly, collision-free 6-digit numeric PIN
      let pin = '';
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = String(Math.floor(100000 + Math.random() * 900000));
        const collision = active.some(t => String(t.pin || t.pickupCode) === candidate);
        if (!collision) {
          pin = candidate;
          break;
        }
      }
      if (!pin) {
        pin = String(Math.floor(100000 + Math.random() * 900000));
      }

      const shareItem = {
        id: 'sh_' + Math.random().toString(36).substring(2, 9) + '_' + now,
        pin,
        content: trimmedContent,
        title: (title || '').trim().slice(0, 100) || (trimmedContent.startsWith('http') ? 'Shared Link' : 'Shared Note'),
        type: type || (trimmedContent.startsWith('http') ? 'link' : 'text'),
        creatorDevice: (deviceToken || '').trim().slice(0, 32),
        creatorUser: userId || null,
        creatorEmail: email || null,
        createdAt: now,
        expiresAt: now + SEVEN_DAYS_MS,
        views: 0
      };

      const updated = [shareItem, ...active];
      await saveTransfers(supabase, updated);

      return res.status(200).json({
        success: true,
        share: {
          id: shareItem.id,
          pin: shareItem.pin,
          content: shareItem.content,
          title: shareItem.title,
          type: shareItem.type,
          createdAt: shareItem.createdAt,
          expiresAt: shareItem.expiresAt
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
