/**
 * Local Storage Persistence Layer for Qvlink
 * Guarantees that guest shortened links, pastes, and files are always preserved
 * on the local device, even if Supabase cloud storage RLS blocks anonymous writes.
 */

const STORAGE_KEYS = {
  LINKS: 'qvlink_local_links_v2',
  PASTES: 'qvlink_local_pastes_v2',
  FILES: 'qvlink_local_files_v2',
  LEGACY_LINKS: 'qivlink_local_links_cache'
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isExpired(timestamp) {
  if (!timestamp) return false;
  const created = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  return Date.now() - created > SEVEN_DAYS_MS;
}

/**
 * Safely read and parse array from localStorage
 */
function readArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Auto-filter items older than 7 days
    const active = parsed.filter(item => !isExpired(item.createdAt));
    if (active.length !== parsed.length) {
      writeArray(key, active);
    }
    return active;
  } catch (err) {
    console.warn(`[LocalStore] Failed reading ${key}:`, err);
    return [];
  }
}

/**
 * Safely persist array to localStorage
 */
function writeArray(key, array) {
  try {
    localStorage.setItem(key, JSON.stringify(array || []));
    return true;
  } catch (err) {
    console.warn(`[LocalStore] Failed writing ${key}:`, err);
    return false;
  }
}

// ============================================================================
// Links Management
// ============================================================================

export function getLocalLinks() {
  let links = readArray(STORAGE_KEYS.LINKS);
  // Migrate legacy links cache if empty
  if (links.length === 0) {
    const legacy = readArray(STORAGE_KEYS.LEGACY_LINKS);
    if (legacy.length > 0) {
      links = legacy;
      writeArray(STORAGE_KEYS.LINKS, links);
    }
  }
  return links;
}

export function saveLocalLink(newLink) {
  if (!newLink || !newLink.id) return;
  const current = getLocalLinks();
  const exists = current.some(l => l.id === newLink.id || l.shortCode === newLink.shortCode);
  if (!exists) {
    const updated = [newLink, ...current];
    writeArray(STORAGE_KEYS.LINKS, updated);
  }
}

export function saveAllLocalLinks(links) {
  writeArray(STORAGE_KEYS.LINKS, links || []);
}

export function removeLocalLink(linkId) {
  const current = getLocalLinks();
  const updated = current.filter(l => l.id !== linkId);
  writeArray(STORAGE_KEYS.LINKS, updated);
  return updated;
}

// ============================================================================
// Pastes / Docs Management
// ============================================================================

export function getLocalPastes() {
  return readArray(STORAGE_KEYS.PASTES);
}

export function saveLocalPaste(newPaste) {
  if (!newPaste || !newPaste.id) return;
  const current = getLocalPastes();
  const exists = current.some(p => p.id === newPaste.id || p.code === newPaste.code);
  if (!exists) {
    const updated = [newPaste, ...current];
    writeArray(STORAGE_KEYS.PASTES, updated);
  }
}

export function saveAllLocalPastes(pastes) {
  writeArray(STORAGE_KEYS.PASTES, pastes || []);
}

export function removeLocalPaste(pasteId) {
  const current = getLocalPastes();
  const updated = current.filter(p => p.id !== pasteId && p.code !== pasteId);
  writeArray(STORAGE_KEYS.PASTES, updated);
  return updated;
}

// ============================================================================
// Files Management
// ============================================================================

export function getLocalFiles() {
  return readArray(STORAGE_KEYS.FILES);
}

export function saveLocalFile(newFile) {
  if (!newFile || !newFile.id) return;
  const current = getLocalFiles();
  const exists = current.some(f => f.id === newFile.id);
  if (!exists) {
    const updated = [newFile, ...current];
    writeArray(STORAGE_KEYS.FILES, updated);
  }
}

export function saveAllLocalFiles(files) {
  writeArray(STORAGE_KEYS.FILES, files || []);
}

export function removeLocalFile(fileId) {
  const current = getLocalFiles();
  const updated = current.filter(f => f.id !== fileId);
  writeArray(STORAGE_KEYS.FILES, updated);
  return updated;
}
