import { randomBytes } from 'node:crypto';
import {
  decryptPayload,
  encryptPayload,
  isValidEncryptionKey,
} from './encryption.util';

describe('encryption.util', () => {
  const key = randomBytes(32).toString('hex');

  it('round-trips a payload', () => {
    const plaintext = JSON.stringify({ hello: 'world' });
    const encrypted = encryptPayload(plaintext, key);

    expect(decryptPayload(encrypted, key)).toBe(plaintext);
  });

  it('produces a different iv (and ciphertext) on every call', () => {
    const a = encryptPayload('same input', key);
    const b = encryptPayload('same input', key);

    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('fails to decrypt with the wrong key', () => {
    const encrypted = encryptPayload('secret', key);
    const wrongKey = randomBytes(32).toString('hex');

    expect(() => decryptPayload(encrypted, wrongKey)).toThrow();
  });

  it('fails to decrypt a tampered payload (GCM auth tag catches it)', () => {
    const encrypted = encryptPayload('secret', key);
    const tampered = {
      ...encrypted,
      data: Buffer.from('tampered').toString('base64'),
    };

    expect(() => decryptPayload(tampered, key)).toThrow();
  });

  describe('isValidEncryptionKey', () => {
    it('accepts a 64-char hex string', () => {
      expect(isValidEncryptionKey(key)).toBe(true);
    });

    it('rejects anything else', () => {
      expect(isValidEncryptionKey('too-short')).toBe(false);
      expect(isValidEncryptionKey(undefined)).toBe(false);
      expect(isValidEncryptionKey('')).toBe(false);
    });
  });
});
