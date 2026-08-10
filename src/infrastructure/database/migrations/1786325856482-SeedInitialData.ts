import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Datos base para arrancar en desarrollo: un admin, el árbol de menús,
 * catálogo de permisos, roles y sus asignaciones.
 *
 * Todas las filas se atribuyen a un usuario real vía subconsulta por
 * "UserName" (nunca un Id literal): como "CreatedById" ahora es una FK de
 * verdad a "User"."Id", no hay forma de "inventar" un autor con un string
 * suelto como se hacía antes con 'admin'/'system'.
 *
 * ADVERTENCIA: todos los usuarios de ejemplo comparten el mismo
 * PasswordHash/PasswordSalt — es un hash PBKDF2-HMAC-SHA256 real (ver
 * src/common/utils/password-hashing.util.ts), generado para la
 * contraseña "Passw0rd1!". Sirve para loguearte en dev con cualquiera de
 * estos usuarios, pero es una contraseña conocida y pública (está en este
 * archivo) — nunca corras este seed en un ambiente compartido/staging sin
 * regenerar hashes reales y distintos por usuario.
 */
export class SeedInitialData1786325856482 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) USUARIO "system"
    // Es el único registro de todo el esquema con CreatedById NULL: no
    // existe ningún usuario previo que pueda figurar como su autor. No es
    // una cuenta con la que alguien pueda iniciar sesión (State = false,
    // password/salt son bytes de relleno que no corresponden a ningún
    // hash real) — existe solo para ser el autor de los datos de arranque
    // que no tiene sentido atribuirle a "admin" (como la creación del
    // propio admin).
    await queryRunner.query(`
      INSERT INTO "User" (
        "UserName", "Email", "FirstName", "LastName", "PasswordHash", "PasswordSalt",
        "SecurityStamp", "State", "CreatedAt", "CreatedById"
      )
      VALUES (
        'system', NULL, 'System', 'Account',
        decode('00', 'hex'), decode('00', 'hex'),
        gen_random_uuid(), false, CURRENT_TIMESTAMP, NULL
      )
    `);

    // 2) USUARIO ADMIN
    await queryRunner.query(`
      INSERT INTO "User" (
        "UserName",
        "Email",
        "FirstName",
        "LastName",
        "PasswordHash",
        "PasswordSalt",
        "LastLoginAt",
        "FailedLoginAttempts",
        "LockoutEnd",
        "PasswordChangedAt",
        "TwoFactorEnabled",
        "TwoFactorSecret",
        "SecurityStamp",
        "State",
        "Photo",
        "CreatedAt",
        "CreatedById"
      )
      SELECT
        'admin',
        'admin@example.com',
        'admin',
        'admin',

        -- MISMA CONTRASEÑA QUE ico@gmail.com
        decode(
          'd6b7168d2d07a5b5cdefdf0c0f7c6bd1f581236c95754df5504883de19a80a6af693bc21567ba9fc14f86a6a49b1a62213e6e1309711adffdf2a865781fd9f39',
          'hex'
        ),

        decode(
          '39eb987d38fc1603d205023f02b73a06',
          'hex'
        ),

        NULL,
        0,
        NULL,
        NULL,
        false,
        NULL,
        gen_random_uuid(),
        true,
        '',
        CURRENT_TIMESTAMP,
        sys."Id"
      FROM (
        SELECT "Id"
        FROM "User"
        WHERE "UserName" = 'system'
      ) AS sys
    `);

    // 3) MENÚS RAÍZ (grupos, sin Url ni padre)
    await queryRunner.query(`
      INSERT INTO "Menu" ("Code", "Name", "DisplayOrder", "CreatedById")
      SELECT v."Code", v."Name", v."DisplayOrder", adm."Id"
      FROM (VALUES
        ('DASH','Dashboard',1),
        ('USER','Usuarios',2),
        ('PROD','Productos',3),
        ('REP','Reportes',4),
        ('CONF','Configuración',5),
        ('INV','Inventario',6),
        ('ORD','Órdenes',7),
        ('BILL','Facturación',8),
        ('SUPP','Proveedores',9),
        ('HELP','Ayuda',10)
      ) AS v("Code","Name","DisplayOrder")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 4) MENÚS HIJOS (enlaces con Url, cuelgan de un menú raíz por Id 1-10)
    // Code sigue el patrón <CODE_PADRE>_<SUFIJO> para que quede legible y
    // sin choques entre ramas distintas del árbol.
    await queryRunner.query(`
      INSERT INTO "Menu" ("ParentMenuId", "Code", "Name", "Url", "CreatedById")
      SELECT v."ParentMenuId", v."Code", v."Name", v."Url", adm."Id"
      FROM (VALUES
        (1,'DASH_HOME','Inicio','/dashboard/inicio'),
        (2,'USER_MANAGE','Gestión Usuarios','/usuarios/gestion'),
        (3,'PROD_CATALOG','Catálogo Productos','/productos/catalogo'),
        (4,'REP_SALES','Reportes Ventas','/reportes/ventas'),
        (5,'CONF_PARAMS','Parámetros','/configuracion/parametros'),
        (6,'INV_IN','Entradas Inventario','/inventario/entradas'),
        (6,'INV_OUT','Salidas Inventario','/inventario/salidas'),
        (7,'ORD_PENDING','Órdenes Pendientes','/ordenes/pendientes'),
        (8,'BILL_ISSUED','Facturas Emitidas','/facturacion/emitidas'),
        (9,'SUPP_MANAGE','Gestión Proveedores','/proveedores/gestion'),
        (6,'INV_ADJUST','Ajustes Inventario','/inventario/ajustes'),
        (6,'INV_STOCK','Stock Actual','/inventario/stock'),
        (8,'BILL_CREDIT_NOTE','Notas de Crédito','/facturacion/notas-credito'),
        (2,'USER_ROLES','Roles','/usuarios/roles'),
        (2,'USER_PERMISSIONS','Permisos','/usuarios/permisos'),
        (4,'REP_KPI','KPIs','/reportes/kpis'),
        (4,'REP_DAILY','Reporte Diario','/reportes/diario'),
        (10,'HELP_FAQ','FAQ','/ayuda/faq'),
        (10,'HELP_CONTACT','Contacto Soporte','/ayuda/contacto'),
        (7,'ORD_HISTORY','Historial Órdenes','/ordenes/historial')
      ) AS v("ParentMenuId","Code","Name","Url")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    // -> Estos 20 quedan con Id 11..30, en el mismo orden en que se insertan.

    // 5) PERMISOS
    // MenuId ata cada permiso a su pantalla natural (para agruparlos en la
    // UI de administración de roles); los Id de Menu son los definidos en
    // el bloque "MENÚS HIJOS" de arriba (11..30).
    await queryRunner.query(`
      INSERT INTO "Permission" ("Code", "Name", "Description", "MenuId", "CreatedById")
      SELECT v."Code", v."Name", v."Description", v."MenuId", adm."Id"
      FROM (VALUES
        ('USR_READ','Leer Usuarios','Permite ver usuarios',12),
        ('USR_WRITE','Editar Usuarios','Permite crear/editar usuarios',12),
        ('PROD_MGMT','Gestionar Productos','Permite crear/editar productos',13),
        ('REP_VIEW','Ver Reportes','Permite consultar reportes',14),
        ('CONF_SYS','Configurar Sistema','Permite gestionar configuración',15),
        ('INV_READ','Leer Inventario','Permite ver el inventario',22),
        ('INV_WRITE','Actualizar Inventario','Permite modificar inventario',21),
        ('ORD_MGMT','Gestionar Órdenes','Permite procesar órdenes',18),
        ('BILL_MGMT','Gestionar Facturas','Permite crear y editar facturas',19),
        ('SUPP_MGMT','Gestionar Proveedores','Permite administrar proveedores',20)
      ) AS v("Code","Name","Description","MenuId")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 6) ROLES
    // Solo "Administrador" se marca IsSystemRole: la aplicación debe
    // impedir borrarlo o quitarle el rol al último usuario que lo tenga,
    // para no dejar el sistema sin ningún acceso administrativo.
    await queryRunner.query(`
      INSERT INTO "Role" ("Code", "Name", "Description", "IsSystemRole", "CreatedById")
      SELECT v."Code", v."Name", v."Description", v."IsSystemRole", adm."Id"
      FROM (VALUES
        ('ADMIN','Administrador','Acceso total al sistema',true),
        ('SUP','Supervisor','Acceso avanzado con permisos limitados',false),
        ('OPER','Operador','Gestión operativa',false),
        ('CONS','Consulta','Solo lectura',false),
        ('GUEST','Invitado','Acceso restringido',false),
        ('SALES','Ventas','Gestión de ventas y reportes',false),
        ('STORE','Almacén','Manejo de inventario',false),
        ('BILLING','Facturación','Gestión de facturación',false),
        ('SUPPORT','Soporte','Atención al cliente',false),
        ('AUDIT','Auditor','Acceso a logs y auditorías',false),
        ('USER','User','Rol estándar: solo lectura en todo',false)
      ) AS v("Code","Name","Description","IsSystemRole")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 7) USUARIOS EXTRA
    // Mismo hash/salt que "admin" — misma contraseña de prueba
    // "Passw0rd1!" para todos, documentado en el comentario de arriba.
    await queryRunner.query(`
      INSERT INTO "User"
      ("UserName","Email","FirstName","LastName","PasswordHash","PasswordSalt","SecurityStamp","State","Photo","CreatedAt","CreatedById")
      SELECT
        v."UserName", v."Email", v."FirstName", v."LastName",
        decode('b90efe621fc76a08a09f6e7a9c5c8db958cad73c444208ec5cdb9e99d5aabb90','hex'),
        decode('821eabeec79a13d89640bf8740cab629','hex'),
        gen_random_uuid(), true, '', CURRENT_TIMESTAMP, adm."Id"
      FROM (VALUES
        ('supervisor','supervisor@example.com','Supervisor','General'),
        ('operador','operador@example.com','Operador','Almacen'),
        ('consulta','consulta@example.com','Usuario','Consulta'),
        ('invitado','invitado@example.com','Guest','User'),
        ('ventas1','ventas1@example.com','Vendedor','Uno'),
        ('almacen1','almacen1@example.com','Almacen','Uno'),
        ('billing1','billing1@example.com','Billing','Uno'),
        ('soporte1','soporte1@example.com','Soporte','Uno'),
        ('auditor1','auditor1@example.com','Auditor','Uno'),
        ('userstd','userstd@example.com','Usuario','Estandar')
      ) AS v("UserName","Email","FirstName","LastName")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 8) ROLE -> MENU (antes ROLE -> SUBMENÚ; ids desplazados +10)
    await queryRunner.query(`
      INSERT INTO "RoleMenu" ("RoleId","MenuId","CreatedById")
      SELECT v."RoleId", v."MenuId", adm."Id"
      FROM (VALUES
        (1,11),(1,12),(1,13),(1,14),(1,15),
        (1,16),(1,17),(1,18),(1,19),(1,20),
        (1,21),(1,22),(1,23),(1,24),(1,25),
        (1,26),(1,27),(1,28),(1,29),(1,30),
        (2,13),(2,14),(2,24),(2,26),(2,27),
        (3,16),(3,17),(3,21),(3,22),
        (4,11),(4,14),(4,26),(4,22),
        (5,11),(5,28),
        (6,18),(6,19),(6,14),(6,26),(6,30),
        (7,16),(7,17),(7,21),(7,22),
        (8,19),(8,23),(8,14),(8,26),
        (9,28),(9,29),
        (10,14),(10,26),(10,27),
        (11,11),(11,14),(11,22)
      ) AS v("RoleId","MenuId")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 9) ROLE -> PERMISSIONS
    // El MenuId por fila que tenía el script original ya no existe: ese
    // mismo par (RoleId, PermissionId) aparecía repetido con distinto
    // MenuId (ej. rol 3 con el permiso 7 apuntando a dos pantallas
    // distintas), lo cual era la fuente de datos "sin sentido". Como el
    // contexto de pantalla ahora es propiedad del Permission (ver arriba),
    // aquí solo queda un par único por fila.
    await queryRunner.query(`
      INSERT INTO "RolePermission" ("RoleId","PermissionId","CreatedById")
      SELECT v."RoleId", v."PermissionId", adm."Id"
      FROM (VALUES
        (1,1),(1,2),(1,3),(1,4),(1,5),
        (2,3),(2,4),
        (3,6),(3,7),
        (4,4),(4,6),
        (6,8),(6,9),
        (8,9),
        (10,4),
        (11,1),(11,4),(11,6),(11,9)
      ) AS v("RoleId","PermissionId")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 10) USER -> ROLE
    // 'auditor1' recibe dos roles (AUDIT + CONS) a propósito: demuestra
    // que el permiso efectivo de un usuario es la unión de TODOS sus
    // roles activos. El rol AUDIT no tiene permisos propios en el seed;
    // sin el rol CONS, "UserPermission" no devolvería ninguna fila para
    // este usuario.
    await queryRunner.query(`
      INSERT INTO "UserRole" ("UserId","RoleId","CreatedById")
      SELECT admUser."Id", admRole."Id", admUser."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS admUser
      CROSS JOIN (SELECT "Id" FROM "Role" WHERE "Code" = 'ADMIN') AS admRole
    `);
    await queryRunner.query(`
      INSERT INTO "UserRole" ("UserId","RoleId","CreatedById")
      SELECT u."Id", r."Id", adm."Id"
      FROM (
        VALUES
          ('supervisor','SUP'),
          ('operador','OPER'),
          ('consulta','CONS'),
          ('invitado','GUEST'),
          ('ventas1','SALES'),
          ('almacen1','STORE'),
          ('billing1','BILLING'),
          ('soporte1','SUPPORT'),
          ('auditor1','AUDIT'),
          ('auditor1','CONS'),
          ('userstd','USER')
      ) AS x("UserName","RoleCode")
      JOIN "User" u ON u."UserName" = x."UserName"
      JOIN "Role" r ON r."Code" = x."RoleCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 11) AUDITORÍA (registros de ejemplo)
    // 'invitado' reemplaza al 'guest' del script original: no existía tal
    // username en la tabla User, así que no era más que un string suelto
    // sin ninguna fila real detrás.
    await queryRunner.query(`
      INSERT INTO "Audit" ("UserId","Type","TableName","PrimaryKey","AffectedColumns")
      SELECT u."Id", x."Type", x."TableName", x."PrimaryKey", x."AffectedColumns"
      FROM (
        VALUES
          ('admin','INSERT','User','1','UserName,Email'),
          ('supervisor','UPDATE','Role','2','Description'),
          ('admin','DELETE','Menu','3','Name,Code'),
          ('invitado','LOGIN','User','N/A',NULL),
          ('admin','LOGOUT','User','N/A',NULL),
          ('operador','INSERT','Product','10','Name,Price'),
          ('consulta','SELECT','Report','N/A','Filters'),
          ('admin','UPDATE','Permission','4','Description'),
          ('supervisor','DELETE','UserRole','7','UserId,RoleId'),
          ('ventas1','INSERT','Order','15','OrderDate,Total')
      ) AS x("UserName","Type","TableName","PrimaryKey","AffectedColumns")
      JOIN "User" u ON u."UserName" = x."UserName"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "Audit"`);
    await queryRunner.query(`DELETE FROM "UserRole"`);
    await queryRunner.query(`DELETE FROM "RolePermission"`);
    await queryRunner.query(`DELETE FROM "RoleMenu"`);
    await queryRunner.query(`DELETE FROM "Role"`);
    await queryRunner.query(`DELETE FROM "Permission"`);
    await queryRunner.query(`DELETE FROM "Menu"`);
    await queryRunner.query(`DELETE FROM "User"`);
  }
}
