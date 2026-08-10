import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  data: string;
}

/** AES-256-GCM. La key es un string hex de 64 caracteres (32 bytes). */
export function encryptPayload(
  plaintext: string,
  keyHex: string,
): EncryptedPayload {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
}

/** Contraparte de encryptPayload — tira si la key no matchea o el payload fue alterado. */
export function decryptPayload(
  payload: EncryptedPayload,
  keyHex: string,
): string {
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function isValidEncryptionKey(key: string | undefined): key is string {
  return typeof key === 'string' && /^[0-9a-f]{64}$/i.test(key);
}
