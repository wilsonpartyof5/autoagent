import sodium from 'libsodium-wrappers';

let encryptionKey: Uint8Array | null = null;

/**
 * Initialize encryption key from environment
 */
function initializeKey(): Uint8Array | null {
  if (encryptionKey !== null) {
    return encryptionKey;
  }

  const keyBase64 = process.env.LEAD_ENC_KEY;
  
  if (!keyBase64) {
    return null;
  }

  try {
    encryptionKey = new Uint8Array(Buffer.from(keyBase64, 'base64'));
    if (encryptionKey.length !== 32) {
      throw new Error('LEAD_ENC_KEY must be 32 bytes (base64 encoded)');
    }
  } catch (error) {
    console.error('Invalid LEAD_ENC_KEY:', error);
    return null;
  }

  return encryptionKey;
}

/**
 * JSON value type for decrypted data
 */
type JSONValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JSONValue[] 
  | { [key: string]: JSONValue };

/**
 * Decrypt base64 string to JSON object
 */
export async function decryptToJson(b64: string): Promise<JSONValue> {
  await sodium.ready;
  
  const key = initializeKey();
  if (!key) {
    throw new Error('LEAD_ENC_KEY not configured');
  }

  const combined = new Uint8Array(Buffer.from(b64, 'base64'));
  
  // Split nonce and ciphertext
  const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
  
  // Decrypt
  const plaintextBytes = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  const plaintext = sodium.to_string(plaintextBytes);
  
  return JSON.parse(plaintext);
}

/**
 * Check if decryption is available
 */
export function canDecrypt(): boolean {
  return initializeKey() !== null;
}
