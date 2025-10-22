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
 * Decrypt base64 string to JSON object
 */
export async function decryptToJson(b64: string): Promise<unknown> {
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
 * Decrypted lead data structure
 */
export interface DecryptedLead {
  user: {
    name: string;
    email: string;
    phone?: string;
    preferredTime?: string;
  };
  vehicleId: string;
  dealerId?: string;
  vin?: string;
}

/**
 * Type guard to validate decrypted lead data
 */
export function isDecryptedLead(data: unknown): data is DecryptedLead {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check if user object exists and has required fields
  if (typeof obj.user !== 'object' || obj.user === null) {
    return false;
  }

  const user = obj.user as Record<string, unknown>;

  return (
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    (user.phone === undefined || typeof user.phone === 'string') &&
    (user.preferredTime === undefined || typeof user.preferredTime === 'string') &&
    typeof obj.vehicleId === 'string' &&
    (obj.dealerId === undefined || typeof obj.dealerId === 'string') &&
    (obj.vin === undefined || typeof obj.vin === 'string')
  );
}

/**
 * Check if decryption is available
 */
export function canDecrypt(): boolean {
  return initializeKey() !== null;
}
