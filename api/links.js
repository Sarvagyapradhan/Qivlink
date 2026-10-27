import { createClient } from '@supabase/supabase-js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const activeKey = serviceKey || anonKey;
  return createClient(supabaseUrl, activeKey);
}

const BUCKET = process.env.VITE_SUPABASE_BUCKET || 'qivlink_store';

async function fetchLinks(supabase) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download('links.json');
    if (error || !data) return [];
    const text = await data.text();
    const list = JSON.parse(text);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

async function saveLinks(supabase, list) {
  try {
    const payload = JSON.stringify(list, null, 2);
    const blob = Buffer.from(payload, 'utf8');
    await supabase.storage.from(BUCKET).upload('links.json', blob, {
      upsert: true,
      contentType: 'application/json',
      cacheControl: '0'
    });
    return true;
  } catch (e) {
    console.warn('Links write notice:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const supabase = getSupabaseClient();
  const now = Date.now();

  // GET: Fetch all active links or a single link by ?code=
  if (req.method === 'GET') {
    try {
      const codeQuery = req.query.code || req.query.shortCode;
      const links = await fetchLinks(supabase);
      const active = links.filter(l => now - (l.createdAt || 0) <= SEVEN_DAYS_MS);

      if (codeQuery) {
        const clean = String(codeQuery).trim().toLowerCase();
        const found = active.find(l => String(l.shortCode || '').trim().toLowerCase() === clean);
        if (!found) {
          return res.status(404).json({ success: false, error: 'Link not found or expired.' });
        }
        return res.status(200).json({ success: true, link: found });
      }

      return res.status(200).json({ success: true, links: active });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST: Create or save a link
  if (req.method === 'POST') {
    try {
      const { link } = req.body || {};
      if (!link || !link.shortCode || !link.targetUrl) {
        return res.status(400).json({ success: false, error: 'Invalid link payload' });
      }

      const links = await fetchLinks(supabase);
      const active = links.filter(l => now - (l.createdAt || 0) <= SEVEN_DAYS_MS);
      const cleanCode = String(link.shortCode).trim().toLowerCase();

      // Check collision
      const existing = active.find(l => String(l.shortCode || '').trim().toLowerCase() === cleanCode && l.id !== link.id);
      if (existing) {
        return res.status(409).json({ success: false, error: 'Short code already taken.' });
      }

      const updated = [link, ...active.filter(l => l.id !== link.id && l.shortCode !== link.shortCode)];
      await saveLinks(supabase, updated);

      return res.status(200).json({ success: true, link });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // DELETE: Remove a link
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing ID' });
      const links = await fetchLinks(supabase);
      const filtered = links.filter(l => l.id !== id);
      await saveLinks(supabase, filtered);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
