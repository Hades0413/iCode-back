import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Corre DESPUÉS de SessionAuthGuard (necesita req.user ya puesto).
 * Resuelve @RequirePermission() contra la vista "UserPermission" — la
 * unión de los permisos de TODOS los roles activos del usuario, ver
 * migrations/README.md. No tiene efecto en rutas sin el decorador.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermission) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('No autenticado');
    }

    const rows = await this.dataSource.query<unknown[]>(
      `SELECT 1 FROM "UserPermission" WHERE "UserId" = $1 AND "PermissionCode" = $2`,
      [user.id, requiredPermission],
    );

    if (rows.length === 0) {
      throw new ForbiddenException(`Falta el permiso ${requiredPermission}`);
    }

    return true;
  }
}
