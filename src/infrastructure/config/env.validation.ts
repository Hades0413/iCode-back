import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().allow('').required(),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_SYNCHRONIZE: Joi.boolean().default(false),
  DATABASE_LOGGING: Joi.boolean().default(false),
  DATABASE_SSL: Joi.boolean().default(false),

  // "*" solo es aceptable en desarrollo; en producción hay que listar los
  // orígenes reales separados por coma (ej. "https://app.miempresa.com").
  CORS_ORIGIN: Joi.string().default('*'),

  THROTTLE_TTL_MS: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),

  // Solo hace falta si algún endpoint usa @EncryptResponse() — 32 bytes en
  // hex. Generarla con: openssl rand -hex 32
  RESPONSE_ENCRYPTION_KEY: Joi.string().hex().length(64).optional(),

  // Sesión = token opaco guardado (hasheado) en "UserSession", no JWT — así
  // el logout puede invalidarlo de verdad (RevokedAt) en vez de esperar a
  // que expire solo. No hace falta un secreto de firma: no hay nada que
  // verificar criptográficamente, solo una fila en la tabla.
  //
  // Expiración DESLIZANTE, no fija desde el login: cada request
  // autenticado extiende "ExpiresAt" otros N días (ver SessionAuthGuard).
  // Pensado para el cliente móvil (React Native) con soporte offline: un
  // usuario sin internet por horas o días no debería perder la sesión
  // justo al momento de sincronizar — solo expira si el dispositivo queda
  // SIN usarse (ni un solo request) más de N días seguidos.
  SESSION_IDLE_TTL_DAYS: Joi.number().default(30),

  // GET /admin/sessions/online: cuántos minutos sin actividad antes de
  // dejar de contar a alguien como "en línea ahora". Con la expiración
  // deslizante de 30 días, "sesión activa" no significa "usando la app en
  // este momento" — esto sí.
  ONLINE_THRESHOLD_MINUTES: Joi.number().default(15),

  // Puente 18+ — carpeta (volumen Docker) donde se guarda el binario de la
  // carta de contrarreferencia. Ver PUENTE18_FRONTEND_INTEGRATION.md.
  COUNTER_REFERRAL_STORAGE_PATH: Joi.string().default(
    './storage/counter-referrals',
  ),
});
