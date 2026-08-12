import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { hashSessionToken } from '../../common/utils/session-token.util';
import { SESSION_COOKIE_NAME } from '../../common/constants/security.constants';

interface SessionRow {
  SessionId: string;
  UserId: number;
  UserName: string;
}

/**
 * Global (ver app.module.ts) — toda ruta exige sesión salvo que tenga
 * @Public(). Valida contra "UserSession" en vez de verificar una firma:
 * no hay JWT acá, así que el logout (RevokedAt) y desactivar un usuario
 * (User.State) invalidan el token en el acto, en la próxima request —
 * nunca hay que esperar a que expire solo.
 *
 * Expiración DESLIZANTE: cada request válido empuja "ExpiresAt" otros
 * SESSION_IDLE_TTL_DAYS días para adelante (pensado para el cliente móvil
 * offline-first — ver env.validation.ts). Una sesión solo muere si el
 * dispositivo pasa esos días enteros sin hacer ni un request.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractSessionToken(request);
    if (!token) {
      throw new UnauthorizedException(
        'Falta el header Authorization o la cookie de sesión',
      );
    }

    const tokenHash = hashSessionToken(token);
    const rows = await this.dataSource.query<SessionRow[]>(
      `
      SELECT s."Id" AS "SessionId", u."Id" AS "UserId", u."UserName" AS "UserName"
      FROM "UserSession" s
      JOIN "User" u ON u."Id" = s."UserId"
      WHERE s."Token" = $1
        AND s."RevokedAt" IS NULL
        AND s."DeletedAt" IS NULL
        AND s."ExpiresAt" > now()
        AND u."State" = true
        AND u."DeletedAt" IS NULL
      `,
      [tokenHash],
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const idleTtlDays = this.config.get<number>('app.sessionIdleTtlDays', 30);
    await this.dataSource.query(
      `UPDATE "UserSession" SET "ExpiresAt" = now() + make_interval(days => $1::int), "LastActivityAt" = now() WHERE "Id" = $2`,
      [idleTtlDays, rows[0].SessionId],
    );

    (
      request as Request & {
        user: { id: number; userName: string; sessionId: string };
      }
    ).user = {
      id: rows[0].UserId,
      userName: rows[0].UserName,
      sessionId: rows[0].SessionId,
    };

    return true;
  }
}

/**
 * El header gana si viene (Swagger, Postman, un futuro cliente móvil sin
 * cookie jar); si no, cae a la cookie httpOnly que puso
 * `POST /auth/login` — la que usa iCode-front. Ninguna reemplaza a la
 * otra, ver SESSION_COOKIE_NAME.
 */
function extractSessionToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return (request.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE_NAME
  ];
}
