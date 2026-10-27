import { getStorageData, setStorageData } from '../supabase.js';

const STORAGE_KEY = 'qvlink_current_device';
const LEGACY_STORAGE_KEY = 'qivlink_current_device';
const FINGERPRINT_KEY = 'qvlink_device_fingerprint';

function generateRandomCode(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function detectDeviceType() {
  if (typeof navigator === 'undefined') return 'Web Client';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'Android Device';
  if (/iPad|iPhone|iPod/.test(ua)) return 'Apple Mobile';
  if (/Macintosh|Mac OS X/.test(ua)) return 'MacBook / Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux Machine';
  return 'Web Client';
}

/**
 * Robust, tamper-resistant Canvas + Hardware Fingerprinting
 * Combines screen geometry, canvas rendering hash, timezone, concurrency, and storage tokens
 */
export function getDeviceFingerprint() {
  try {
    // 1. Check persistent memory
    const cached = localStorage.getItem(FINGERPRINT_KEY) || sessionStorage.getItem(FINGERPRINT_KEY);
    if (cached) return cached;

    // 2. Compute Canvas rendering signature
    let canvasHash = 'c_0';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial, sans-serif';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Qvlink,isAwesome! <canvas> 1.0', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Qvlink,isAwesome! <canvas> 1.0', 4, 17);
        const dataUrl = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < dataUrl.length; i++) {
          hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
          hash |= 0;
        }
        canvasHash = 'c_' + Math.abs(hash).toString(36);
      }
    } catch (e) {}

    // 3. Hardware & environment signals
    const screenSig = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`;
    const timezoneSig = new Date().getTimezoneOffset();
    const cores = navigator.hardwareConcurrency || 4;
    const lang = navigator.language || 'en';
    const platform = navigator.platform || 'web';

    const rawString = `${canvasHash}|${screenSig}|${timezoneSig}|${cores}|${lang}|${platform}`;
    
    // Hash raw string into 32-char hex
    let hashNum = 5381;
    for (let i = 0; i < rawString.length; i++) {
      hashNum = ((hashNum << 5) + hashNum) + rawString.charCodeAt(i);
    }
    const fp = 'fp_' + Math.abs(hashNum).toString(36) + '_' + Math.random().toString(36).substring(2, 8);

    try {
      localStorage.setItem(FINGERPRINT_KEY, fp);
      sessionStorage.setItem(FINGERPRINT_KEY, fp);
      document.cookie = `__qvl_fp=${fp}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {}

    return fp;
  } catch (err) {
    return 'fp_fallback_' + Math.random().toString(36).substring(2, 9);
  }
}

/**
 * Gets or initializes this browser's unique device token
 */
export function getLocalDevice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate token prefix if needed
      if (parsed.token && parsed.token.startsWith('QIV-')) {
        parsed.token = parsed.token.replace('QIV-', 'QVL-');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch (e) {
    console.warn('localStorage read error', e);
  }

  // Create new identity
  const idToken = `QVL-${generateRandomCode(4)}-${generateRandomCode(3)}`;
  const pairPin = Math.floor(100000 + Math.random() * 900000).toString();
  const device = {
    token: idToken,
    pin: pairPin,
    name: detectDeviceType(),
    fingerprint: getDeviceFingerprint(),
    registeredAt: Date.now(),
    lastSeen: Date.now()
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(device));
  } catch (e) {}

  return device;
}

export function saveLocalDevice(device) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(device));
  } catch (e) {}
}

/**
 * Announce/heartbeat this device to Supabase registry
 */
export async function registerDeviceInCloud(device) {
  try {
    const devices = await getStorageData('devices', []);
    const filtered = devices.filter(d => d.token !== device.token && Date.now() - d.lastSeen < 7 * 86400000);
    filtered.push({
      token: device.token,
      name: device.name,
      fingerprint: device.fingerprint || getDeviceFingerprint(),
      lastSeen: Date.now(),
      registeredAt: device.registeredAt
    });
    await setStorageData('devices', filtered);
    return filtered;
  } catch (e) {
    console.error('Failed to register device:', e);
    return [];
  }
}

/**
 * Fetch list of known devices from cloud registry
 */
export async function fetchKnownDevices() {
  try {
    const devices = await getStorageData('devices', []);
    return devices.filter(d => Date.now() - (d.lastSeen || 0) < 7 * 86400000);
  } catch (e) {
    return [];
  }
}
