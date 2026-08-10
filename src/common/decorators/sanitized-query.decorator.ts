import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { sanitizeValue } from '../utils/sanitize.util';

/**
 * Igual que @Query(), pero sanitizado. Existe porque SanitizeMiddleware NO
 * puede hacer este trabajo por vos: en Express 5, "req.query" es un getter
 * que reparsea la URL en cada acceso, así que un middleware que reasigna
 * req.query no tiene ningún efecto real (ver sanitize.middleware.ts).
 * Sanitizar acá, en el punto donde Nest extrae el valor, sí funciona.
 *
 *   @Get('buscar')
 *   buscar(@SanitizedQuery('q') termino: string) { ... }
 *
 *   @Get()
 *   listar(@SanitizedQuery() query: Record<string, string>) { ... }
 */
export const sanitizedQueryFactory = (
  data: string | undefined,
  ctx: ExecutionContext,
): unknown => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const query = sanitizeValue(request.query as Record<string, unknown>);
  return data ? query[data] : query;
};

export const SanitizedQuery = createParamDecorator(sanitizedQueryFactory);
