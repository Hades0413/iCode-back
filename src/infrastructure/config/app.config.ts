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
  counterReferralStoragePath:
    process.env.COUNTER_REFERRAL_STORAGE_PATH ?? './storage/counter-referrals',
  referralReviewStoragePath:
    process.env.REFERRAL_REVIEW_STORAGE_PATH ?? './storage/referral-reviews',
  transitionSummaryStoragePath:
    process.env.TRANSITION_SUMMARY_STORAGE_PATH ??
    './storage/transition-summaries',
  patientAttachmentStoragePath:
    process.env.PATIENT_ATTACHMENT_STORAGE_PATH ?? './storage/attachments',
  // Sin valor por defecto a propósito: si no está configurada, "generar
  // con IA" contesta 503 en vez de fingir con una plantilla — ver
  // OpenAiSummaryDraftingService.
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
}));
