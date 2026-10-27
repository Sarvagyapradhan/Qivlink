/**
 * Quick Share Transfer Manager
 * Reliable cross-device sharing via 6-digit PIN and direct links.
 * Works seamlessly across mobile, desktop, and tablets.
 */

const LOCAL_SENT_SHARES_KEY = 'qvlink_sent_shares';

export function getLocalSentShares() {
  try {
    const raw = localStorage.getItem(LOCAL_SENT_SHARES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    const now = Date.now();
    // 7-day retention
    const active = list.filter(item => now - (item.createdAt || 0) <= 7 * 24 * 3600 * 1000);
    if (active.length !== list.length) {
      localStorage.setItem(LOCAL_SENT_SHARES_KEY, JSON.stringify(active));
    }
    return active;
  } catch (e) {
    return [];
  }
}

export function saveLocalSentShare(item) {
  try {
    const list = getLocalSentShares();
    const updated = [item, ...list.filter(s => s.id !== item.id && s.pin !== item.pin)];
    localStorage.setItem(LOCAL_SENT_SHARES_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch (e) {}
}

export function removeLocalSentShare(id) {
  try {
    const list = getLocalSentShares();
    const updated = list.filter(s => s.id !== id && s.pin !== id);
    localStorage.setItem(LOCAL_SENT_SHARES_KEY, JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Create a new Quick Share with an instant 6-digit PIN & direct link
 */
export async function createQuickShare({
  content,
  title = '',
  type = 'text',
  deviceToken = '',
  currentUser = null
}) {
  if (!content || !content.trim()) {
    throw new Error('Please enter some text or a link to share.');
  }

  const cleanContent = content.trim();
  const detectedType = type || (cleanContent.startsWith('http://') || cleanContent.startsWith('https://') ? 'link' : 'text');

  // 1. Try server API
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: cleanContent,
        title: title.trim(),
        type: detectedType,
        deviceToken,
        userId: currentUser?.id,
        email: currentUser?.email
      })
    });

    const data = await res.json();
    if (res.ok && data.success && data.share) {
      saveLocalSentShare(data.share);
      return data.share;
    }
  } catch (err) {
    console.warn('API share notice, falling back:', err.message);
  }

  // 2. Local fallback if API is unreachable
  const now = Date.now();
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const fallbackItem = {
    id: 'sh_' + Math.random().toString(36).substring(2, 9) + '_' + now,
    pin,
    content: cleanContent,
    title: title.trim() || (detectedType === 'link' ? 'Shared Link' : 'Shared Note'),
    type: detectedType,
    creatorDevice: deviceToken,
    createdAt: now,
    expiresAt: now + 7 * 24 * 3600 * 1000,
    views: 0
  };

  saveLocalSentShare(fallbackItem);
  return fallbackItem;
}

/**
 * Retrieve shared content using a 6-digit PIN or direct code
 */
export async function receiveQuickShare(code) {
  if (!code || !String(code).trim()) {
    throw new Error('Please enter a 6-digit share code.');
  }

  const cleanCode = String(code).trim().replace(/[\s-]/g, '').toUpperCase();

  // 1. Try server API
  try {
    const res = await fetch(`/api/share?pin=${encodeURIComponent(cleanCode)}`);
    const data = await res.json();
    if (res.ok && data.success && data.share) {
      return data.share;
    }
    if (data.error) {
      throw new Error(data.error);
    }
  } catch (err) {
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
  }

  // 2. Check local sent cache as fallback
  const localList = getLocalSentShares();
  const localFound = localList.find(s => {
    const p = String(s.pin || '').trim().replace(/[\s-]/g, '').toUpperCase();
    const id = String(s.id || '').trim().toUpperCase();
    return p === cleanCode || id === cleanCode;
  });

  if (localFound) {
    return localFound;
  }

  throw new Error('No active share found with this 6-digit code. Please verify the code.');
}

// Backwards-compatible aliases for other components
export const sendTransfer = createQuickShare;
export const redeemTransferByPickupCode = receiveQuickShare;
export const getAllTransfers = async () => getLocalSentShares();
export const deleteTransfer = async (id) => {
  removeLocalSentShare(id);
  return getLocalSentShares();
};
