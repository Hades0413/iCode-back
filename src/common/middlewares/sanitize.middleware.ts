import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { sanitizeValue } from '../utils/sanitize.util';

/**
 * Sanitiza req.body antes de que llegue a un controller. No reemplaza la
 * validación por DTO (class-validator) — es una red de seguridad adicional
 * para cuando todavía no hay una DTO estricta para ese campo, o para datos
 * que van a terminar mostrándose en algún frontend tal cual.
 *
 * Solo toca req.body a propósito: en Express 5, "req.query" es un getter
 * que reparsea la URL en cada acceso (no cachea el resultado ni tiene un
 * setter real), así que asignarle un valor nuevo no tira error pero
 * tampoco tiene ningún efecto — el próximo `req.query` (incluido el que ve
 * el @Query() de Nest) vuelve a devolver la versión sin tocar. Confirmado
 * a mano contra un server Express real antes de asumirlo. Para sanitizar
 * query params, usá el decorador @SanitizedQuery() en el controller en vez
 * de esperar que este middleware lo haga por vos.
 */
@Injectable()
export class SanitizeMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body as Record<string, unknown>);
    }

    next();
  }
}
