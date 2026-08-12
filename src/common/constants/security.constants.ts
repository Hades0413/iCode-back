import { HelmetOptions } from 'helmet';

/**
 * Un solo lugar para tocar cabeceras de seguridad, en vez de tener
 * `helmet()` a secas en main.ts sin que quede claro qué se está pidiendo
 * ni por qué. Probado contra Swagger UI (@nestjs/swagger sirve todo same-
 * origin, sin scripts inline, así que el CSP por defecto de Helmet no lo
 * rompe) — si algún día se sirve algo que sí necesite `unsafe-inline` o un
 * origen externo, se agrega acá explícitamente, no aflojando todo el CSP.
 */
export const HELMET_OPTIONS: Readonly<HelmetOptions> = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
  hsts: {
    // Mismo maxAge que el `Strict-Transport-Security` de nginx
    // (docker/nginx/nginx.conf) — si se cambia acá, cambiar allá también.
    maxAge: 63072000,
    includeSubDomains: true,
  },
  referrerPolicy: { policy: 'no-referrer' },
};

/**
 * Para cuando exista el endpoint de registro/cambio de contraseña. Nadie
 * lo usa todavía — está acá para que la primera DTO de password no invente
 * su propia regla.
 */
export const PASSWORD_POLICY = {
  MIN_LENGTH: 12,
  // Al menos una minúscula, una mayúscula, un número y un símbolo.
  PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).+$/,
  DESCRIPTION:
    'Mínimo 12 caracteres, con al menos una minúscula, una mayúscula, un número y un símbolo.',
};

/**
 * El token de sesión viaja de dos formas, a propósito, no una sola:
 *
 * - **Cookie httpOnly** (esta constante) — la usa el front web
 *   (iCode-front): el JS del navegador nunca la puede leer, así un XSS no
 *   puede robar el token. `SessionAuthGuard` la acepta como alternativa al
 *   header.
 * - **Header `Authorization: Bearer`** — sigue existiendo para Swagger,
 *   Postman, y un futuro cliente móvil (React Native no tiene el manejo
 *   automático de cookies de un navegador) — ver el body de
 *   `POST /auth/login`, que sigue devolviendo el token igual que siempre.
 *
 * Ninguna reemplaza a la otra — `SessionAuthGuard` prueba el header
 * primero y cae a la cookie si no está.
 */
export const SESSION_COOKIE_NAME = 'icode_session';

/** Límites por defecto de paginación — ver src/common/dto/pagination-query.dto.ts */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
};
