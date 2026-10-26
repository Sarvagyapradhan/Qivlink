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

// Supabase client instance using service role key (or anon key) for robust sync
export const supabase = createClient(SUPABASE_CONFIG.url, activeKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
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

export async function uploadFileToCloud(file) {
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
    createdAt: timestamp,
    expiresAt: timestamp + SEVEN_DAYS_MS
  };

  const files = await getStorageData('files', []);
  const updated = [fileItem, ...files];
  await setStorageData('files', updated);

  return fileItem;
}

export async function getActiveFiles() {
  const files = await getStorageData('files', []);
  return files.filter(f => !isExpired(f.createdAt));
}

export async function deleteFileFromCloud(fileId) {
  const files = await getActiveFiles();
  const target = files.find(f => f.id === fileId);
  if (target && target.storagePath) {
    supabase.storage.from(SUPABASE_CONFIG.bucketName).remove([target.storagePath]).catch(() => {});
  }
  const filtered = files.filter(f => f.id !== fileId);
  await setStorageData('files', filtered);
  return filtered;
}

/**
 * Long-Form Paste / Docs Helpers (Markdown, Short URL, QR, PDF Export)
 */
export async function createPasteDoc({ title = '', content = '', format = 'markdown' }) {
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
    createdAt: now,
    expiresAt: now + SEVEN_DAYS_MS
  };

  const pastes = await getStorageData('pastes', []);
  const updated = [pasteItem, ...pastes];
  await setStorageData('pastes', updated);
  return pasteItem;
}

export async function getActivePastes() {
  const pastes = await getStorageData('pastes', []);
  return pastes.filter(p => !isExpired(p.createdAt));
}

export async function getPasteByIdOrCode(identifier) {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  const pastes = await getActivePastes();
  const found = pastes.find(p => p.id.toLowerCase() === clean || p.code.toLowerCase() === clean);
  if (!found || isExpired(found.createdAt)) return null;
  return found;
}

export async function deletePasteDoc(id) {
  const pastes = await getActivePastes();
  const filtered = pastes.filter(p => p.id !== id);
  await setStorageData('pastes', filtered);
  return filtered;
}

