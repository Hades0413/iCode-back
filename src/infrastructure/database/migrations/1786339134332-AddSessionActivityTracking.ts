import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Para el panel de "usuarios en línea" (GET /admin/sessions/online):
 * "ExpiresAt" solo dice cuándo muere la sesión si nadie la usa — no
 * cuándo fue la última vez que alguien SÍ la usó. "LastActivityAt" es
 * explícito para eso: SessionAuthGuard lo actualiza junto con "ExpiresAt"
 * en cada request válido (la misma extensión deslizante, ver
 * migrations/README.md).
 *
 * También agrega el permiso "ADMIN_VIEW_SESSIONS" y se lo da a
 * Administrador — nadie más lo tiene por defecto.
 */
export class AddSessionActivityTracking1786339134332 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "UserSession"
      ADD COLUMN "LastActivityAt" timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
    `);
    await queryRunner.query(
      `CREATE INDEX "IX_UserSession_LastActivityAt" ON "UserSession" ("LastActivityAt")`,
    );

    await queryRunner.query(`
      INSERT INTO "Permission" ("Code", "Name", "Description", "CreatedById")
      SELECT 'ADMIN_VIEW_SESSIONS', 'Ver sesiones activas', 'Permite ver qué usuarios están conectados y desde dónde', adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    await queryRunner.query(`
      INSERT INTO "RolePermission" ("RoleId", "PermissionId", "CreatedById")
      SELECT role."Id", perm."Id", adm."Id"
      FROM (SELECT "Id" FROM "Role" WHERE "Code" = 'ADMIN') AS role
      CROSS JOIN (SELECT "Id" FROM "Permission" WHERE "Code" = 'ADMIN_VIEW_SESSIONS') AS perm
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "RolePermission"
      WHERE "PermissionId" = (SELECT "Id" FROM "Permission" WHERE "Code" = 'ADMIN_VIEW_SESSIONS')
    `);
    await queryRunner.query(
      `DELETE FROM "Permission" WHERE "Code" = 'ADMIN_VIEW_SESSIONS'`,
    );
    await queryRunner.query(`DROP INDEX "IX_UserSession_LastActivityAt"`);
    await queryRunner.query(
      `ALTER TABLE "UserSession" DROP COLUMN "LastActivityAt"`,
    );
  }
}
