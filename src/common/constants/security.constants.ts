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

/** Límites por defecto de paginación — ver src/common/dto/pagination-query.dto.ts */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
};
