import { getDeviceFingerprint } from './deviceIdentity.js';
import { checkGuestUsageAllowed, recordGuestUsage } from '../supabase.js';

const LOCAL_USAGE_KEY = 'qvlink_guest_usage_cache';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export const TOOL_NAMES = {
  shorten: 'Link Shortener',
  qr: 'QR Code Generator',
  paste: 'Paste & Docs',
  files: 'File Sharing',
  sharing: 'Device Beam Sharing'
};

/**
 * Check if the current user/device is permitted to execute an action
 * - Logged-in users: UNLIMITED
 * - Guests: 1 use per tool per 24 hours
 */
export async function verifyToolUsage(toolKey, currentUser = null) {
  // Signed-in accounts have unlimited usage
  if (currentUser) {
    return {
      allowed: true,
      isUnlimited: true,
      remaining: Infinity,
      toolName: TOOL_NAMES[toolKey] || toolKey
    };
  }

  const fingerprint = getDeviceFingerprint();

  // 1. Fast local verification
  try {
    const raw = localStorage.getItem(LOCAL_USAGE_KEY);
    if (raw) {
      const records = JSON.parse(raw);
      const entry = records[toolKey];
      if (entry && (Date.now() - entry < TWENTY_FOUR_HOURS_MS)) {
        const remainingMs = TWENTY_FOUR_HOURS_MS - (Date.now() - entry);
        const hoursLeft = Math.ceil(remainingMs / (60 * 60 * 1000));
        return {
          allowed: false,
          isUnlimited: false,
          remaining: 0,
          hoursLeft,
          toolName: TOOL_NAMES[toolKey] || toolKey
        };
      }
    }
  } catch (e) {}

  // 2. Cross-device & cloud ledger verification (prevents incognito / wipe bypass)
  try {
    const cloudCheck = await checkGuestUsageAllowed(fingerprint, toolKey);
    if (!cloudCheck.allowed) {
      // Sync to local
      try {
        const raw = localStorage.getItem(LOCAL_USAGE_KEY);
        const records = raw ? JSON.parse(raw) : {};
        records[toolKey] = cloudCheck.nextResetTime - TWENTY_FOUR_HOURS_MS;
        localStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify(records));
      } catch (e) {}

      return {
        allowed: false,
        isUnlimited: false,
        remaining: 0,
        hoursLeft: cloudCheck.hoursLeft,
        toolName: TOOL_NAMES[toolKey] || toolKey
      };
    }
  } catch (e) {
    console.warn('Cloud rate limit notice:', e);
  }

  return {
    allowed: true,
    isUnlimited: false,
    remaining: 1,
    toolName: TOOL_NAMES[toolKey] || toolKey
  };
}

/**
 * Record action consumption after successful execution
 */
export async function consumeToolUsage(toolKey, currentUser = null) {
  if (currentUser) return; // No consumption tracking needed for unlimited accounts

  const fingerprint = getDeviceFingerprint();
  const now = Date.now();

  // 1. Record locally
  try {
    const raw = localStorage.getItem(LOCAL_USAGE_KEY);
    const records = raw ? JSON.parse(raw) : {};
    records[toolKey] = now;
    localStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify(records));
  } catch (e) {}

  // 2. Record to cloud ledger
  try {
    await recordGuestUsage(fingerprint, toolKey);
  } catch (e) {
    console.warn('Failed to record cloud usage ledger:', e);
  }
}
