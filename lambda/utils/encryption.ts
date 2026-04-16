import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 600000, KEY_LENGTH, 'sha256');
}

function getSecret(): string {
  return process.env.ENCRYPTION_SECRET || 'default-secret-change-in-production';
}

export function encrypt(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(getSecret(), salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ct = cipher.update(plaintext, 'utf8', 'hex');
  ct += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, Buffer.from(ct, 'hex')]).toString('base64');
}

export function decrypt(encrypted: string): string {
  const buf = Buffer.from(encrypted, 'base64');
  const salt = buf.subarray(0, SALT_LENGTH);
  const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buf.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const ct = buf.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const key = deriveKey(getSecret(), salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let pt = decipher.update(ct.toString('hex'), 'hex', 'utf8');
  pt += decipher.final('utf8');
  return pt;
}
