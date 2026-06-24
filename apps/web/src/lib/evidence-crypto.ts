// Client-side AES-GCM encryption for evidence files.
// Keys are generated per-session and stored in sessionStorage only.
// The IV (12 bytes) is prepended to the ciphertext before upload.
// The original SHA-256 hash (computed on plaintext) is sent to the server
// as the integrity anchor — not the ciphertext hash.

const KEY_STORE_PREFIX = 'abhaya_ek_';

async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function exportKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

async function importKey(raw: string): Promise<CryptoKey> {
  const jwk = JSON.parse(raw) as JsonWebKey;
  return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

function storeKey(incidentId: string, raw: string): void {
  try {
    sessionStorage.setItem(KEY_STORE_PREFIX + incidentId, raw);
  } catch { /* sessionStorage may be unavailable in some browsers */ }
}

function loadKey(incidentId: string): string | null {
  try {
    return sessionStorage.getItem(KEY_STORE_PREFIX + incidentId);
  } catch {
    return null;
  }
}

async function getOrCreateKey(incidentId: string): Promise<CryptoKey> {
  const stored = loadKey(incidentId);
  if (stored) {
    return importKey(stored);
  }
  const key = await generateKey();
  const raw = await exportKey(key);
  storeKey(incidentId, raw);
  return key;
}

export interface EncryptResult {
  encryptedBlob: Blob;
  sha256Hash:    string;   // of plaintext — for integrity verification
  keyJwk:        string;   // base64 JWK export (caller may store separately)
}

export async function encryptEvidence(
  file: File,
  incidentId: string,
): Promise<EncryptResult> {
  const buffer = await file.arrayBuffer();

  // SHA-256 of plaintext for integrity
  const hashBuf  = await crypto.subtle.digest('SHA-256', buffer);
  const sha256Hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const key = await getOrCreateKey(incidentId);
  const iv  = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    buffer,
  );

  // Prepend IV so decryption can recover it: [12 bytes IV | ciphertext]
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  const encryptedBlob = new Blob([combined], { type: 'application/octet-stream' });
  const keyJwk = await exportKey(key);

  return { encryptedBlob, sha256Hash, keyJwk };
}

export async function decryptEvidence(
  encryptedBlob: Blob,
  incidentId: string,
): Promise<ArrayBuffer> {
  const data = await encryptedBlob.arrayBuffer();
  const iv   = new Uint8Array(data, 0, 12);
  const body = new Uint8Array(data, 12);

  const key = await getOrCreateKey(incidentId);

  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, body);
}

export function clearEvidenceKey(incidentId: string): void {
  try {
    sessionStorage.removeItem(KEY_STORE_PREFIX + incidentId);
  } catch { /* noop */ }
}
