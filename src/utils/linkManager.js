import { getStorageData, setStorageData, isExpired, SEVEN_DAYS_MS } from '../supabase.js';
import { getLocalLinks, saveLocalLink, saveAllLocalLinks, removeLocalLink } from './localStore.js';

const FORBIDDEN_PROTOCOLS = [
  'javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:', 'chrome:', 'moz-extension:', 'ws:', 'wss:'
];

const FORBIDDEN_HOSTS = [
  'localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '[::1]', '::1'
];


/**
 * Validates and sanitizes destination URLs with strict security policies
 */
export function sanitizeUrl(inputUrl, stripTracking = true) {
  let urlStr = (inputUrl || '').trim();
  if (!urlStr) {
    throw new Error('Please enter a valid destination URL.');
  }

  // Pre-check for forbidden schemes
  const lower = urlStr.toLowerCase();
  for (const forbidden of FORBIDDEN_PROTOCOLS) {
    if (lower.startsWith(forbidden)) {
      throw new Error(`Security violation: Protocol "${forbidden}" is not allowed.`);
    }
  }

  // Add https:// by default if missing
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = 'https://' + urlStr;
  }

  let urlObj;
  try {
    urlObj = new URL(urlStr);
  } catch (e) {
    throw new Error('Invalid URL format. Please provide a standard web address.');
  }

  // Strict protocol check
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    throw new Error('Only secure http: and https: protocols are permitted.');
  }

  // Loopback / SSRF check
  const host = urlObj.hostname.toLowerCase();
  if (FORBIDDEN_HOSTS.includes(host) || host.endsWith('.localhost')) {
    throw new Error('Loopback and private intranet addresses are blocked for security.');
  }

  // Strip tracking parameters if enabled
  if (stripTracking) {
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
      '_ga', '_gl', 'yclid', 'zanpid', 'igshid', 'twclid', 'ref_src'
    ];
    trackingParams.forEach(param => urlObj.searchParams.delete(param));
  }

  return urlObj.toString();
}

export function generateShortCode(length = 6) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Fetch all active links, merging local device cache with Supabase cloud storage.
 * Local links are prioritized so guest shortened links are NEVER lost or overwritten.
 */
export async function getActiveLinks(deviceToken = null, currentUser = null) {
  const localLinks = getLocalLinks() || [];

  const tokenClean = (deviceToken || '').trim().toLowerCase();
  const userId = currentUser?.id;
  const userEmail = (currentUser?.email || '').trim().toLowerCase();

  // Fetch cloud links (preferring server API with service role key, fallback to direct download)
  let cloudLinks = [];
  try {
    const res = await fetch('/api/links');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.links)) {
        cloudLinks = json.links;
      }
    }
  } catch (e) {}

  if (cloudLinks.length === 0) {
    try {
      cloudLinks = await getStorageData('links', []);
    } catch (err) {}
  }

  // If caller is doing a global lookup (for redirect routing or alias collision check)
  if (!tokenClean && !userId && !userEmail) {
    const linkMap = new Map();
    (cloudLinks || []).forEach(item => {
      if (item && item.shortCode && !isExpired(item.createdAt)) {
        linkMap.set(String(item.shortCode).toLowerCase(), item);
      }
    });
    // Add all active local links
    localLinks.forEach(item => {
      if (item && item.shortCode && !isExpired(item.createdAt)) {
        linkMap.set(String(item.shortCode).toLowerCase(), item);
      }
    });
    return Array.from(linkMap.values());
  }

  // Filter local links strictly for this device or signed-in user
  const myLocalLinks = localLinks.filter(item => {
    if (!item || !item.shortCode || isExpired(item.createdAt)) return false;
    const dev = (item.creatorDevice || '').trim().toLowerCase();
    const uId = item.creatorUser;
    const uEmail = (item.creatorEmail || '').trim().toLowerCase();

    if (tokenClean && dev && dev === tokenClean) return true;
    if (userId && uId && uId === userId) return true;
    if (userEmail && uEmail && uEmail === userEmail) return true;
    return false;
  });

  // Filter cloud links strictly for this device or signed-in user
  const myCloudLinks = (cloudLinks || []).filter(item => {
    if (!item || !item.shortCode || isExpired(item.createdAt)) return false;
    const dev = (item.creatorDevice || '').trim().toLowerCase();
    const uId = item.creatorUser;
    const uEmail = (item.creatorEmail || '').trim().toLowerCase();

    const matchDevice = Boolean(tokenClean && dev && dev === tokenClean);
    const matchUser = Boolean((userId && uId && uId === userId) || (userEmail && uEmail && uEmail === userEmail));
    return matchDevice || matchUser;
  });

  // Merge this user's cloud and local links
  const resultMap = new Map();
  myCloudLinks.forEach(l => resultMap.set(l.id, l));
  myLocalLinks.forEach(l => resultMap.set(l.id, l));

  return Array.from(resultMap.values());
}

/**
 * Create a new privacy-focused shortened link with 7-day TTL and security verification.
 * Automatically saves to localStorage so guests always see their created links in History.
 */
export async function createShortLink({
  url,
  customAlias = '',
  title = '',
  stripTracking = true,
  deviceToken = '',
  currentUser = null
}) {
  const cleanUrl = sanitizeUrl(url, stripTracking);
  let code = (customAlias || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');

  if (code.length > 64) {
    throw new Error('Custom alias cannot exceed 64 characters.');
  }

  if (!code) {
    code = generateShortCode(6);
  }

  const existing = await getActiveLinks(null);
  if (existing.some(l => String(l.shortCode).toLowerCase() === code.toLowerCase())) {
    throw new Error(`The alias "${code}" is already active. Please pick another one or leave blank for auto-generation.`);
  }

  const now = Date.now();
  let linkTitle = (title || '').trim().slice(0, 120);
  if (!linkTitle) {
    try {
      linkTitle = new URL(cleanUrl).hostname.replace(/^www\./, '');
    } catch (e) {
      linkTitle = 'Shortened Link';
    }
  }

  const newLink = {
    id: 'lnk_' + Math.random().toString(36).substring(2, 9) + '_' + now,
    shortCode: code,
    originalUrl: url.trim(),
    targetUrl: cleanUrl,
    title: linkTitle,
    stripTracking,
    creatorDevice: (deviceToken || '').trim().slice(0, 32),
    creatorUser: currentUser?.id || null,
    creatorEmail: currentUser?.email || null,
    createdAt: now,
    expiresAt: now + SEVEN_DAYS_MS,
    clicks: 0
  };

  // 1. Immediately persist to localStorage so it is never lost for guests
  saveLocalLink(newLink);

  // 2. Persist to cloud via /api/links (using backend service role key)
  try {
    await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: newLink })
    });
  } catch (err) {
    // Fallback direct storage write
    setStorageData('links', [newLink, ...existing.filter(l => l.shortCode !== newLink.shortCode)]).catch(() => {});
  }

  return newLink;
}

/**
 * Delete a link by ID from both local storage and cloud storage
 */
export async function deleteLink(id, deviceToken = null) {
  // Remove from local storage
  removeLocalLink(id);

  // Remove via API
  try {
    await fetch(`/api/links?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {}

  // Fallback direct storage
  try {
    const cloudLinks = await getStorageData('links', []);
    const filteredCloud = (cloudLinks || []).filter(l => l.id !== id);
    setStorageData('links', filteredCloud).catch(() => {});
  } catch (err) {}

  // Return updated active list for device
  return getActiveLinks(deviceToken);
}

/**
 * Find link by shortCode, increment click counter, and return sanitized redirect info
 */
export async function resolveLink(code) {
  if (!code) return null;
  const cleanCode = String(code).trim().toLowerCase();

  // 1. Check local storage first (instant)
  const localLinks = getLocalLinks() || [];
  const localMatch = localLinks.find(l => 
    l && l.shortCode && 
    String(l.shortCode).toLowerCase() === cleanCode && 
    !isExpired(l.createdAt)
  );
  if (localMatch) {
    try {
      localMatch.targetUrl = sanitizeUrl(localMatch.targetUrl, false);
      return localMatch;
    } catch (e) {}
  }

  // 2. Check /api/links?code=
  try {
    const res = await fetch(`/api/links?code=${encodeURIComponent(cleanCode)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.link && !isExpired(data.link.createdAt)) {
        data.link.targetUrl = sanitizeUrl(data.link.targetUrl, false);
        return data.link;
      }
    }
  } catch (e) {}

  // 3. Fallback to getActiveLinks(null)
  const all = await getActiveLinks(null);
  const found = all.find(l => String(l.shortCode).toLowerCase() === cleanCode);
  if (!found || isExpired(found.createdAt)) return null;

  try {
    found.targetUrl = sanitizeUrl(found.targetUrl, false);
    return found;
  } catch (e) {
    return null;
  }
}

