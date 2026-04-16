import crypto from 'crypto';

/**
 * Encryption utilities for secure token storage
 * Uses AES-256-GCM for encryption with a derived key
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Derive an encryption key from a secret using PBKDF2
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 600000, KEY_LENGTH, 'sha256');
}

/**
 * Get encryption secret from environment or use default (for development)
 * In production, this should always come from environment variables
 */
function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    console.warn('WARNING: ENCRYPTION_SECRET not set, using default (not secure for production)');
    return 'default-secret-key-change-in-production';
  }
  return secret;
}

/**
 * Encrypt a plaintext string
 * Returns a base64-encoded string containing: salt + iv + tag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const secret = getEncryptionSecret();
  
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive key from secret
  const key = deriveKey(secret, salt);
  
  // Create cipher and encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  // Get authentication tag
  const tag = cipher.getAuthTag();
  
  // Combine salt + iv + tag + ciphertext and encode as base64
  const combined = Buffer.concat([
    salt,
    iv,
    tag,
    Buffer.from(ciphertext, 'hex')
  ]);
  
  return combined.toString('base64');
}

/**
 * Decrypt an encrypted string
 * Expects a base64-encoded string containing: salt + iv + tag + ciphertext
 */
export function decrypt(encrypted: string): string {
  const secret = getEncryptionSecret();
  
  // Decode from base64
  const combined = Buffer.from(encrypted, 'base64');
  
  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  // Derive key from secret
  const key = deriveKey(secret, salt);
  
  // Create decipher and decrypt
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let plaintext = decipher.update(ciphertext.toString('hex'), 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}
