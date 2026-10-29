import { createClient } from '@supabase/supabase-js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const APP_TABS = ['shorten', 'qr', 'paste', 'files', 'sharing', 'history'];

const FALLBACK_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqanZvYnF3bm5senhzb3Zqb3Z4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzAzMTM4NiwiZXhwIjoyMTA4NjA3Mzg2fQ.PCmiPn9GgytKy5i51zTzXZxYFjoDCqt9JmZLd9dC1tM';

function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || FALLBACK_SERVICE_KEY;
  return createClient(supabaseUrl, serviceKey);
}

const BUCKET = process.env.VITE_SUPABASE_BUCKET || 'qivlink_store';

async function getLinkByCode(supabase, cleanCode) {
  // Method 1: Check dedicated atomic file links/<cleanCode>.json (immune to race conditions & overwrites)
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(`links/${cleanCode}.json`);
    if (data && !error) {
      const text = await data.text();
      const obj = JSON.parse(text);
      if (obj && obj.targetUrl) {
        return obj;
      }
    }
  } catch (_) {}

  // Method 2: Fallback to global links.json array
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download('links.json');
    if (data && !error) {
      const text = await data.text();
      const list = JSON.parse(text);
      if (Array.isArray(list)) {
        const found = list.find(l => l && String(l.shortCode).trim().toLowerCase() === cleanCode);
        if (found) return found;
      }
    }
  } catch (_) {}

  return null;
}

export default async function handler(req, res) {
  const codeParam = req.query.code || req.query.shortCode || '';
  const cleanCode = String(codeParam).trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');

  if (!cleanCode) {
    res.writeHead(302, { Location: '/' });
    return res.end();
  }

  // If this matches an internal app tab, redirect to that tab
  if (APP_TABS.includes(cleanCode)) {
    res.writeHead(302, { Location: `/?tab=${cleanCode}` });
    return res.end();
  }

  const supabase = getSupabaseClient();
  const link = await getLinkByCode(supabase, cleanCode);
  const now = Date.now();

  if (link && link.targetUrl) {
    if (now - (link.createdAt || 0) <= SEVEN_DAYS_MS) {
      let target = link.targetUrl.trim();
      if (!/^https?:\/\//i.test(target)) {
        target = 'https://' + target;
      }

      // Instant HTTP 302 redirect directly to target CDN
      res.writeHead(302, {
        Location: target,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      return res.end();
    }
  }

  // Link not found or expired -> redirect back to app home with notfound notification
  res.writeHead(302, { Location: `/?notfound=${encodeURIComponent(cleanCode)}` });
  return res.end();
}
