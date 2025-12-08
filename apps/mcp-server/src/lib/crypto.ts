import sodium from 'libsodium-wrappers';
import { CONFIG } from '../config/env.js';

let encryptionKey: Uint8Array | null = null;

/**
 * Initialize encryption key from configuration
 * Key is validated at startup via CONFIG.leadEncKey
 */
function initializeKey(): Uint8Array {
  if (encryptionKey) {
    return encryptionKey;
  }

  // CONFIG.leadEncKey is already validated (base64, 32 bytes) at startup
  encryptionKey = new Uint8Array(Buffer.from(CONFIG.leadEncKey, 'base64'));
  
  return encryptionKey;
}

/**
 * Encrypt JSON object to base64 string
 */
export async function encryptJson(obj: unknown): Promise<string> {
  await sodium.ready;
  
  const key = initializeKey();
  const plaintext = JSON.stringify(obj);
  const plaintextBytes = sodium.from_string(plaintext);
  
  // Generate random nonce
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  
  // Encrypt with XSalsa20-Poly1305
  const ciphertext = sodium.crypto_secretbox_easy(plaintextBytes, nonce, key);
  
  // Combine nonce + ciphertext and encode as base64
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, nonce.length);
  
  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt base64 string to JSON object
 */
export async function decryptToJson(b64: string): Promise<unknown> {
  await sodium.ready;
  
  const key = initializeKey();
  const combined = new Uint8Array(Buffer.from(b64, 'base64'));
  
  // Split nonce and ciphertext
  const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
  
  // Decrypt
  const plaintextBytes = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  const plaintext = sodium.to_string(plaintextBytes);
  
  return JSON.parse(plaintext);
}
