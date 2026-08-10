import {
  pbkdf2 as pbkdf2Callback,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(pbkdf2Callback);

const DIGEST = 'sha256';
const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;
// OWASP Password Storage Cheat Sheet: PBKDF2-HMAC-SHA256 >= 600.000
// iteraciones. Async (no *Sync) para no bloquear el event loop en cada
// login — igual conviene que el endpoint de login tenga su propio rate
// limit además del global (ver ThrottlerModule).
const ITERATIONS = 600_000;

export interface PasswordHash {
  hash: Buffer;
  salt: Buffer;
}

/**
 * Hash + salt por separado, como bytea — no el string autocontenido que
 * arma bcrypt/argon2. Coincide con el esquema ya migrado
 * (User.PasswordHash / User.PasswordSalt, ambos bytea).
 */
export async function hashPassword(
  plainPassword: string,
): Promise<PasswordHash> {
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const hash = (await pbkdf2(
    plainPassword,
    salt,
    ITERATIONS,
    KEY_LENGTH_BYTES,
    DIGEST,
  )) as Buffer;

  return { hash, salt };
}

/** Comparación en tiempo constante — nunca uses === contra un hash. */
export async function verifyPassword(
  plainPassword: string,
  storedHash: Buffer,
  storedSalt: Buffer,
): Promise<boolean> {
  const candidate = (await pbkdf2(
    plainPassword,
    storedSalt,
    ITERATIONS,
    KEY_LENGTH_BYTES,
    DIGEST,
  )) as Buffer;

  if (candidate.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(candidate, storedHash);
}
