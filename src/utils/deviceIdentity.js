import { getStorageData, setStorageData } from '../supabase.js';

const STORAGE_KEY = 'qivlink_current_device';

function generateRandomCode(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function detectDeviceType() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'Android Device';
  if (/iPad|iPhone|iPod/.test(ua)) return 'Apple Mobile';
  if (/Macintosh|Mac OS X/.test(ua)) return 'MacBook / Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux Machine';
  return 'Web Client';
}

/**
 * Gets or initializes this browser's unique device token
 */
export function getLocalDevice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('localStorage read error', e);
  }

  // Create new identity
  const idToken = `QIV-${generateRandomCode(4)}-${generateRandomCode(3)}`;
  const pairPin = Math.floor(100000 + Math.random() * 900000).toString();
  const device = {
    token: idToken,
    pin: pairPin,
    name: detectDeviceType(),
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
