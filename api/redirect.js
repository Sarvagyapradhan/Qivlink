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

let cachedLinks = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5000; // 5-second cache for lightning-fast edge redirects

async function getLinks(supabase) {
  const now = Date.now();
  if (cachedLinks && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedLinks;
  }
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download('links.json');
    if (error || !data) return cachedLinks || [];
    const text = await data.text();
    const list = JSON.parse(text);
    if (Array.isArray(list)) {
      cachedLinks = list;
      lastCacheTime = now;
      return list;
    }
    return [];
  } catch (e) {
    return cachedLinks || [];
  }
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
  const links = await getLinks(supabase);
  const now = Date.now();

  const link = links.find(l => {
    if (!l || !l.shortCode) return false;
    if (now - (l.createdAt || 0) > SEVEN_DAYS_MS) return false;
    return String(l.shortCode).trim().toLowerCase() === cleanCode;
  });

  if (link && link.targetUrl) {
    // Basic protocol security verification
    let target = link.targetUrl.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }

    // Instant HTTP 302 redirect with zero intermediate page
    res.writeHead(302, {
      Location: target,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end();
  }

  // Link not found or expired -> redirect back to app home with notfound notification
  res.writeHead(302, { Location: `/?notfound=${encodeURIComponent(cleanCode)}` });
  return res.end();
}
