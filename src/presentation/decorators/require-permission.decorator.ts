import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requiredPermission';

/**
 * PermissionGuard resuelve esto contra la vista "UserPermission" (unión
 * de los permisos de TODOS los roles activos del usuario — ver
 * migrations/README.md). Requiere que SessionAuthGuard ya haya corrido
 * antes y haya puesto req.user.
 *
 *   @RequirePermission('USR_WRITE')
 *   @Patch(':id')
 *   update(...) { ... }
 */
export const RequirePermission = (code: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, code);
