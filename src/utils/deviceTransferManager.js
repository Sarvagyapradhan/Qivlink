import { getStorageData, setStorageData, isExpired, SEVEN_DAYS_MS } from '../supabase.js';
import { encryptPayload, decryptPayload } from './cryptoSecurity.js';

const LOCAL_TRANSFERS_CACHE = 'qivlink_transfers_cache';

export async function getAllTransfers() {
  let list = [];
  try {
    list = await getStorageData('transfers', []);
  } catch (e) {
    try {
      const cached = localStorage.getItem(LOCAL_TRANSFERS_CACHE);
      if (cached) list = JSON.parse(cached);
    } catch (err) {}
  }

  // Auto 7-day purge
  const active = (list || []).filter(item => !isExpired(item.createdAt));
  if (active.length !== list.length) {
    setStorageData('transfers', active).catch(console.error);
  }

  try {
    localStorage.setItem(LOCAL_TRANSFERS_CACHE, JSON.stringify(active));
  } catch (e) {}

  return active;
}

/**
 * Send content to a specific target device token or generate a quick pickup code
 * Secures with AES-256-GCM if passcode is provided.
 */
export async function sendTransfer({
  targetToken,
  pickupCode = '',
  senderDevice,
  contentType = 'link',
  content,
  title = '',
  passcode = '',
  burnAfterRead = false
}) {
  if (!content || !content.trim()) {
    throw new Error('Content cannot be empty');
  }

  const cleanContent = content.trim();
  const hasPasscode = Boolean(passcode && passcode.trim());

  // Encrypt with AES-256-GCM if passcode was set
  let storedContent = cleanContent;
  if (hasPasscode) {
    storedContent = await encryptPayload(cleanContent, passcode.trim());
  }

  const now = Date.now();
  const id = 'tx_' + Math.random().toString(36).substring(2, 9) + '_' + now;
  
  let finalPickupCode = pickupCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!targetToken && !finalPickupCode) {
    finalPickupCode = 'QIV-' + Math.floor(1000 + Math.random() * 9000);
  }

  const transferItem = {
    id,
    targetToken: targetToken ? targetToken.trim().toUpperCase().slice(0, 32) : null,
    pickupCode: finalPickupCode || null,
    senderToken: senderDevice.token,
    senderName: senderDevice.name,
    contentType,
    content: storedContent,
    title: (title || '').trim().slice(0, 100) || (contentType === 'link' ? 'Shared Link' : 'Shared Snippet'),
    hasPasscode,
    burnAfterRead,
    readCount: 0,
    createdAt: now,
    expiresAt: now + SEVEN_DAYS_MS
  };

  const existing = await getAllTransfers();
  const updated = [transferItem, ...existing];
  await setStorageData('transfers', updated);

  try {
    localStorage.setItem(LOCAL_TRANSFERS_CACHE, JSON.stringify(updated));
  } catch (e) {}

  return transferItem;
}

/**
 * Fetch transfers aimed at this device or claimed via pickup code
 */
export async function getTransfersForDevice(deviceToken) {
  const all = await getAllTransfers();
  return all.filter(t => t.targetToken === deviceToken.toUpperCase());
}

/**
 * Redeem / lookup transfer by pickup code and decrypt if encrypted
 */
export async function redeemTransferByPickupCode(code, enteredPasscode = '') {
  if (!code) throw new Error('Please enter a pickup code');
  const clean = code.trim().toUpperCase();
  const all = await getAllTransfers();
  const found = all.find(t => t.pickupCode === clean || (t.id && t.id.toLowerCase() === clean.toLowerCase()));

  if (!found) {
    throw new Error('No active transfer found with this code. It may have expired or was burned.');
  }

  if (isExpired(found.createdAt)) {
    throw new Error('This transfer has expired (7-day maximum retention reached).');
  }

  // Decrypt payload if passcode protected
  let decryptedText = found.content;
  if (found.hasPasscode) {
    decryptedText = await decryptPayload(found.content, enteredPasscode.trim());
  }

  // Update read count / burn after read
  found.readCount = (found.readCount || 0) + 1;
  let remaining = all;
  if (found.burnAfterRead) {
    remaining = all.filter(t => t.id !== found.id);
  }
  await setStorageData('transfers', remaining);

  return {
    ...found,
    content: decryptedText
  };
}

/**
 * Delete a transfer
 */
export async function deleteTransfer(id) {
  const all = await getAllTransfers();
  const filtered = all.filter(t => t.id !== id);
  await setStorageData('transfers', filtered);
  try {
    localStorage.setItem(LOCAL_TRANSFERS_CACHE, JSON.stringify(filtered));
  } catch (e) {}
  return filtered;
}
