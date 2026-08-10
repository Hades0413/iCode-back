import { createHash, randomBytes } from 'node:crypto';

const TOKEN_LENGTH_BYTES = 32;

/** Token opaco de sesión — alta entropía, nada que decodificar ni firmar. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_LENGTH_BYTES).toString('hex');
}

/**
 * Lo que se guarda en UserSession.Token. sha256 alcanza acá — a
 * diferencia de una contraseña, el token ya nace con 256 bits de entropía
 * propios, no hace falta una KDF lenta (PBKDF2) para que sea inviable de
 * adivinar por fuerza bruta.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
