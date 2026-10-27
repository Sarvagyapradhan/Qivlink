import { createClient } from '@supabase/supabase-js';

export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqanZvYnF3bm5senhzb3Zqb3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzEzODYsImV4cCI6MjEwODYwNzM4Nn0.pRcHOLffia7XJ1PjR9PeIYTM4P7cvQ2SjFA2RBhyvtk',
  serviceKey: import.meta.env.VITE_SUPABASE_SERVICE_KEY || '',
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_L2eppszgrtN4TsVYgwLfcA_s8H9MeKr',
  secretKey: import.meta.env.VITE_SUPABASE_SECRET_KEY || '',
  bucketName: import.meta.env.VITE_SUPABASE_BUCKET || 'qivlink_store'
};

const activeKey = SUPABASE_CONFIG.serviceKey || SUPABASE_CONFIG.anonKey;

// Supabase client instance configured with persistent auth for Email & Google OAuth
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Helper for 7-day TTL check (7 days = 604800000 ms)
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isExpired(timestamp) {
  if (!timestamp) return false;
  const created = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  return Date.now() - created > SEVEN_DAYS_MS;
}

export function getRemainingTime(timestamp) {
  if (!timestamp) return '7 days';
  const created = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const expiresAt = created + SEVEN_DAYS_MS;
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/**
 * Storage-backed JSON state sync
 */
export async function getStorageData(key, defaultValue = []) {
  try {
    const filename = `${key}.json`;
    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.bucketName)
      .download(filename);
      
    if (error || !data) {
      return defaultValue;
    }
    
    const text = await data.text();
    const parsed = JSON.parse(text);
    
    // Auto-clean expired items older than 7 days
    if (Array.isArray(parsed)) {
      const active = parsed.filter(item => !isExpired(item.createdAt));
      if (active.length !== parsed.length) {
        // Asynchronously update storage with cleaned array
        setStorageData(key, active).catch(console.error);
      }
      return active;
    }
    return parsed;
  } catch (err) {
    console.warn(`[Supabase Storage] Read notice for ${key}:`, err.message);
    return defaultValue;
  }
}

export async function setStorageData(key, value) {
  try {
    const filename = `${key}.json`;
    const payload = JSON.stringify(value, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    
    const { error } = await supabase.storage
      .from(SUPABASE_CONFIG.bucketName)
      .upload(filename, blob, {
        upsert: true,
        contentType: 'application/json'
      });
      
    if (error) {
      console.warn(`[Supabase Storage] Write fallback:`, error.message);
    }
    return !error;
  } catch (err) {
    console.error(`[Supabase Storage] Write error for ${key}:`, err);
    return false;
  }
}

/**
 * File Sharing Storage Helpers (Max 10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB Supabase bucket limit

export async function uploadFileToCloud(file, deviceToken = '') {
  if (!file) throw new Error('No file provided');
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File exceeds the 10MB storage limit');
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `uploads/${timestamp}_${safeName}`;

  const { error } = await supabase.storage
    .from(SUPABASE_CONFIG.bucketName)
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream'
    });

  if (error) {
    throw new Error(error.message || 'Failed to upload file to cloud storage');
  }

  const { data: urlData } = supabase.storage
    .from(SUPABASE_CONFIG.bucketName)
    .getPublicUrl(storagePath);

  const fileItem = {
    id: 'file_' + Math.random().toString(36).substring(2, 9) + '_' + timestamp,
    name: file.name,
    size: file.size,
    type: file.type || 'unknown',
    storagePath,
    url: urlData.publicUrl,
    creatorDevice: deviceToken,
    createdAt: timestamp,
    expiresAt: timestamp + SEVEN_DAYS_MS
  };

  const files = await getStorageData('files', []);
  const updated = [fileItem, ...files];
  await setStorageData('files', updated);

  return fileItem;
}

export async function getActiveFiles(deviceToken = null) {
  const files = await getStorageData('files', []);
  const active = files.filter(f => !isExpired(f.createdAt));
  if (!deviceToken) return active;
  return active.filter(f => f.creatorDevice && f.creatorDevice === deviceToken);
}

export async function deleteFileFromCloud(fileId, deviceToken = null) {
  const files = await getStorageData('files', []);
  const target = files.find(f => f.id === fileId);
  if (target && target.storagePath) {
    supabase.storage.from(SUPABASE_CONFIG.bucketName).remove([target.storagePath]).catch(() => {});
  }
  const filtered = files.filter(f => f.id !== fileId);
  await setStorageData('files', filtered);
  if (deviceToken) {
    return filtered.filter(f => f.creatorDevice && f.creatorDevice === deviceToken);
  }
  return filtered;
}

/**
 * Long-Form Paste / Docs Helpers (Markdown, Short URL, QR, PDF Export)
 */
export async function createPasteDoc({ title = '', content = '', format = 'markdown', deviceToken = '' }) {
  if (!content || !content.trim()) {
    throw new Error('Content cannot be empty');
  }

  const now = Date.now();
  const code = Math.random().toString(36).substring(2, 8);
  const pasteItem = {
    id: 'p_' + code,
    code,
    title: (title || '').trim() || 'Untitled Note',
    content: content.trim(),
    format,
    creatorDevice: (deviceToken || '').trim(),
    createdAt: now,
    expiresAt: now + SEVEN_DAYS_MS
  };

  const pastes = await getStorageData('pastes', []);
  const updated = [pasteItem, ...pastes];
  await setStorageData('pastes', updated);
  return pasteItem;
}

export async function getActivePastes(deviceToken = null) {
  const pastes = await getStorageData('pastes', []);
  const active = pastes.filter(p => !isExpired(p.createdAt));
  if (!deviceToken) return active;
  return active.filter(p => p.creatorDevice && p.creatorDevice === deviceToken);
}

export async function getPasteByIdOrCode(identifier) {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  const pastes = await getActivePastes(null); // lookup allows opening by anyone with link
  const found = pastes.find(p => p.id.toLowerCase() === clean || p.code.toLowerCase() === clean);
  if (!found || isExpired(found.createdAt)) return null;
  return found;
}

export async function deletePasteDoc(id, deviceToken = null) {
  const pastes = await getStorageData('pastes', []);
  const filtered = pastes.filter(p => p.id !== id);
  await setStorageData('pastes', filtered);
  if (deviceToken) {
    return filtered.filter(p => p.creatorDevice && p.creatorDevice === deviceToken);
  }
  return filtered;
}

/**
 * Developer API Key Management
 */
export async function getUserApiKey(userId) {
  if (!userId) return null;
  const keys = await getStorageData('api_keys', []);
  const found = keys.find(k => k.userId === userId);
  return found || null;
}

export async function generateUserApiKey(userId, userEmail = '') {
  if (!userId) throw new Error('User must be signed in to generate an API key');
  const keys = await getStorageData('api_keys', []);
  const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const keyString = `qvl_live_${randomBytes}`;
  
  const newKeyRecord = {
    userId,
    userEmail,
    apiKey: keyString,
    createdAt: Date.now(),
    lastUsedAt: null,
    requestsCount: 0
  };

  const filtered = keys.filter(k => k.userId !== userId);
  const updated = [newKeyRecord, ...filtered];
  await setStorageData('api_keys', updated);
  return newKeyRecord;
}

export async function validateApiKey(providedKey) {
  if (!providedKey || !providedKey.startsWith('qvl_live_')) return null;
  const keys = await getStorageData('api_keys', []);
  const found = keys.find(k => k.apiKey === providedKey.trim());
  if (found) {
    found.lastUsedAt = Date.now();
    found.requestsCount = (found.requestsCount || 0) + 1;
    setStorageData('api_keys', keys).catch(() => {});
    return found;
  }
  return null;
}

/**
 * 24-Hour Guest Usage Ledger (Cloud & Device Fingerprint Backed)
 */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function getGuestUsageLedger() {
  return await getStorageData('guest_usage_ledger', []);
}

export async function checkGuestUsageAllowed(fingerprint, tool) {
  if (!fingerprint) return { allowed: true, remaining: 1 };
  const ledger = await getGuestUsageLedger();
  const now = Date.now();
  
  // Clean records older than 24h
  const activeEntries = ledger.filter(item => now - item.timestamp < TWENTY_FOUR_HOURS_MS);
  if (activeEntries.length !== ledger.length) {
    setStorageData('guest_usage_ledger', activeEntries).catch(() => {});
  }

  const existing = activeEntries.find(
    item => item.fingerprint === fingerprint && item.tool === tool
  );

  if (existing) {
    const elapsed = now - existing.timestamp;
    const remainingMs = TWENTY_FOUR_HOURS_MS - elapsed;
    const hoursLeft = Math.ceil(remainingMs / (60 * 60 * 1000));
    return {
      allowed: false,
      remaining: 0,
      hoursLeft,
      nextResetTime: existing.timestamp + TWENTY_FOUR_HOURS_MS
    };
  }

  return { allowed: true, remaining: 1, hoursLeft: 0 };
}

export async function recordGuestUsage(fingerprint, tool) {
  if (!fingerprint) return;
  const ledger = await getGuestUsageLedger();
  const now = Date.now();
  const updated = [
    { fingerprint, tool, timestamp: now },
    ...ledger.filter(item => !(item.fingerprint === fingerprint && item.tool === tool))
  ];
  await setStorageData('guest_usage_ledger', updated);
}


