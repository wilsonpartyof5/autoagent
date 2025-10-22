import sodium from 'libsodium-wrappers';

let encryptionKey: Uint8Array | null = null;

/**
 * Initialize encryption key from environment or generate one
 */
function initializeKey(): Uint8Array {
  if (encryptionKey) {
    return encryptionKey;
  }

  const keyBase64 = process.env.LEAD_ENC_KEY;
  
  if (keyBase64) {
    try {
      encryptionKey = new Uint8Array(Buffer.from(keyBase64, 'base64'));
      if (encryptionKey.length !== 32) {
        throw new Error('LEAD_ENC_KEY must be 32 bytes (base64 encoded)');
      }
    } catch (error) {
      console.error('Invalid LEAD_ENC_KEY:', error);
      throw new Error('LEAD_ENC_KEY must be valid base64 and 32 bytes');
    }
  } else {
    // Generate a random key for development
    if (process.env.NODE_ENV !== 'production') {
      const randomKey = crypto.getRandomValues(new Uint8Array(32));
      encryptionKey = randomKey;
      const keyBase64 = Buffer.from(randomKey).toString('base64');
      console.warn('⚠️  LEAD_ENC_KEY not set. Generated random key for development:');
      console.warn(`   Add this to your .env file: LEAD_ENC_KEY=${keyBase64}`);
      console.warn('   ⚠️  This key will change on restart - use a persistent key in production!');
    } else {
      throw new Error('LEAD_ENC_KEY must be set in production');
    }
  }

  return encryptionKey;
}

/**
 * Encrypt JSON object to base64 string
 */
export async function encryptJson(obj: any): Promise<string> {
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
export async function decryptToJson(b64: string): Promise<any> {
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
