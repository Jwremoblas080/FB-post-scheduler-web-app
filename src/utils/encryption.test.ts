import { encrypt, decrypt } from './encryption';

describe('Encryption Utilities', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should encrypt and decrypt a long access token', () => {
      const plaintext = 'EAABsbCS1iHgBO7ZCxqHZCZCqL9ZBfZCZCqL9ZBfZCZCqL9ZBfZCZCqL9ZBfZCZCqL9ZBf';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext', () => {
      const plaintext = 'my-secret-token';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      
      // Different due to random IV and salt
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both decrypt to the same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'token!@#$%^&*()_+-={}[]|:";\'<>?,./';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'token-with-émojis-🔐🔑';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when decrypting invalid data', () => {
      expect(() => decrypt('invalid-base64-data')).toThrow();
    });

    it('should throw error when decrypting tampered data', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encrypt(plaintext);
      
      // Tamper with the encrypted data
      const tampered = encrypted.slice(0, -5) + 'XXXXX';
      
      expect(() => decrypt(tampered)).toThrow();
    });
  });
});
