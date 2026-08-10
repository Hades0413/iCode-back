import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  throttleTtlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  responseEncryptionKey: process.env.RESPONSE_ENCRYPTION_KEY,
  sessionIdleTtlDays: parseInt(process.env.SESSION_IDLE_TTL_DAYS ?? '30', 10),
  onlineThresholdMinutes: parseInt(
    process.env.ONLINE_THRESHOLD_MINUTES ?? '15',
    10,
  ),
}));
