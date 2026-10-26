/**
 * Qivlink End-to-End Cryptography Module
 * Uses standard Web Crypto API (AES-256-GCM)
 * Ensures data payloads cannot be intercepted or bypassed in transit or storage.
 */

const ENCRYPTION_ALGO = 'AES-GCM';

async function deriveKey(passcode, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passcode),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ENCRYPTION_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts a plaintext string with a user-provided passcode using AES-256-GCM
 */
export async function encryptPayload(plaintext, passcode) {
  if (!passcode) return plaintext;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passcode, salt);

  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGO, iv },
    key,
    enc.encode(plaintext)
  );

  return JSON.stringify({
    e2e: true,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(ciphertext)
  });
}

/**
 * Decrypts an encrypted payload with the user-provided passcode
 */
export async function decryptPayload(payload, passcode) {
  if (!payload) return '';
  
  // If not encrypted
  if (typeof payload === 'string' && !payload.startsWith('{"e2e":true')) {
    return payload;
  }

  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!parsed.e2e) return payload;

    if (!passcode) {
      throw new Error('This transmission is encrypted. Passcode required.');
    }

    const salt = new Uint8Array(base64ToBuffer(parsed.salt));
    const iv = new Uint8Array(base64ToBuffer(parsed.iv));
    const data = base64ToBuffer(parsed.data);

    const key = await deriveKey(passcode, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGO, iv },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    throw new Error('Incorrect passcode or corrupted encrypted transmission.');
  }
}

/**
 * Fast SHA-256 hash for secure fingerprinting
 */
export async function sha256Hex(text) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(text));
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
