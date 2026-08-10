import { SetMetadata } from '@nestjs/common';

export const ENCRYPT_RESPONSE_KEY = 'encryptResponse';

/**
 * Marca un handler para que EncryptResponseInterceptor cifre su respuesta
 * con AES-256-GCM en vez de devolver JSON plano. Requiere
 * RESPONSE_ENCRYPTION_KEY configurada (ver .env.example) — si no está,
 * el endpoint responde 500 en vez de filtrar el dato sin cifrar.
 *
 * Usalo solo cuando haga falta cifrar el payload en sí, más allá de HTTPS
 * (que ya cifra todo el tránsito vía nginx) — ver el comentario en
 * EncryptResponseInterceptor para cuándo tiene sentido de verdad.
 *
 *   @Get('datos-sensibles')
 *   @EncryptResponse()
 *   getDatosSensibles() { ... }
 */
export const EncryptResponse = () => SetMetadata(ENCRYPT_RESPONSE_KEY, true);
