import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Datos base para arrancar en desarrollo: identidad/RBAC (admin, árbol de
 * menús, catálogo de permisos, roles) y el dominio "Puente 18+" (ver
 * prompt_contexto_backend_puente18.md) — IPRESS ficticias, personal de
 * salud, y un caso demo de cada estado de la transición (paciente menor
 * con tutor activo / paciente ya adulto con titularidad propia).
 *
 * El árbol de menús y el catálogo de permisos/roles reflejan las
 * pantallas reales de ESTA aplicación (pacientes, historial clínico,
 * autorizaciones, IPRESS) — no quedó nada de un template genérico tipo
 * ERP (productos/inventario/facturación/proveedores) sin relación con el
 * dominio del hackatón.
 *
 * "RoleMenu"/"RolePermission" se arman por Code (Role.Code, Menu.Code,
 * Permission.Code), nunca por Id literal: así se puede reordenar o
 * agregar filas al árbol de menús o al catálogo de permisos sin tener
 * que recalcular a mano qué Id le tocó a cada uno.
 *
 * Todas las filas se atribuyen a un usuario real vía subconsulta por
 * "UserName" (nunca un Id literal): como "CreatedById" es una FK de
 * verdad a "User"."Id", no hay forma de "inventar" un autor con un string
 * suelto.
 *
 * ADVERTENCIA: todos los usuarios de ejemplo comparten el mismo
 * PasswordHash/PasswordSalt — un hash PBKDF2-HMAC-SHA256 real (600.000
 * iteraciones, ver src/common/utils/password-hashing.util.ts), generado
 * con hashPassword() para la contraseña "Passw0rd1!" — no algo copiado de
 * otro sistema (ver el intercambio que llevó a esto: un hash de 64 bytes
 * de otra base de datos, incompatible con nuestro esquema de 32 bytes,
 * nunca hubiera autenticado a nadie). Es una contraseña conocida y
 * pública (está en este archivo) — nunca corras este seed en un ambiente
 * compartido/staging sin regenerar hashes reales y distintos por
 * usuario.
 *
 * Por regla obligatoria del hackatón: todos los pacientes, tutores e
 * IPRESS de acá son ficticios/sintéticos, nunca datos reales.
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
        decode('b90efe621fc76a08a09f6e7a9c5c8db958cad73c444208ec5cdb9e99d5aabb90','hex'),
        decode('821eabeec79a13d89640bf8740cab629','hex'),
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

    // 3) MENÚS RAÍZ (grupos, sin Url ni padre) — reflejan las secciones
    // reales de Puente 18+ más la administración RBAC genérica.
    await queryRunner.query(`
      INSERT INTO "Menu" ("Code", "Name", "DisplayOrder", "CreatedById")
      SELECT v."Code", v."Name", v."DisplayOrder", adm."Id"
      FROM (VALUES
        ('DASH','Dashboard',1),
        ('USER','Usuarios',2),
        ('PATIENT','Pacientes',3),
        ('CLINICAL','Historial Clínico',4),
        ('CONSENT','Autorizaciones',5),
        ('IPRESS','Centros de Salud',6),
        ('REP','Reportes',7),
        ('CONF','Configuración',8),
        ('HELP','Ayuda',9)
      ) AS v("Code","Name","DisplayOrder")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 4) MENÚS HIJOS (enlaces con Url) — el padre se resuelve por
    // Menu.Code, no por Id literal, para poder reordenar el bloque de
    // arriba sin romper nada acá.
    await queryRunner.query(`
      INSERT INTO "Menu" ("ParentMenuId", "Code", "Name", "Url", "CreatedById")
      SELECT parent."Id", v."Code", v."Name", v."Url", adm."Id"
      FROM (VALUES
        ('DASH','DASH_HOME','Inicio','/dashboard/inicio'),
        ('USER','USER_MANAGE','Gestión Usuarios','/usuarios/gestion'),
        ('USER','USER_ROLES','Roles','/usuarios/roles'),
        ('USER','USER_PERMISSIONS','Permisos','/usuarios/permisos'),
        ('USER','USER_SESSIONS','Sesiones en Línea','/usuarios/sesiones'),
        ('PATIENT','PATIENT_MANAGE','Gestión de Pacientes','/pacientes/gestion'),
        ('PATIENT','PATIENT_GUARDIANS','Tutores Legales','/pacientes/tutores'),
        ('CLINICAL','CLINICAL_RECORDS','Registros Clínicos','/historial-clinico/registros'),
        ('CLINICAL','CLINICAL_TRANSITION_FILE','Ficha de Transición','/historial-clinico/ficha-transicion'),
        ('CONSENT','CONSENT_AUTHORIZATIONS','Autorizaciones de Acceso','/autorizaciones/gestion'),
        ('CONSENT','CONSENT_ACCESS_LOG','Bitácora de Accesos','/autorizaciones/bitacora'),
        ('IPRESS','IPRESS_QUERY','Consultar Ficha Clínica','/ipress/consulta'),
        ('IPRESS','IPRESS_FACILITIES','Centros de Salud','/ipress/centros'),
        ('IPRESS','IPRESS_STAFF','Personal de Salud','/ipress/personal'),
        ('REP','REP_KPI','Indicadores','/reportes/indicadores'),
        ('REP','REP_DAILY','Reporte Diario','/reportes/diario'),
        ('CONF','CONF_PARAMS','Parámetros','/configuracion/parametros'),
        ('HELP','HELP_FAQ','FAQ','/ayuda/faq'),
        ('HELP','HELP_CONTACT','Contacto Soporte','/ayuda/contacto')
      ) AS v("ParentCode","Code","Name","Url")
      JOIN "Menu" parent ON parent."Code" = v."ParentCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 5) PERMISOS genéricos de identidad/administración — MenuId se
    // resuelve por Menu.Code (LEFT JOIN: NULL si no aplica a ninguna
    // pantalla puntual).
    await queryRunner.query(`
      INSERT INTO "Permission" ("Code", "Name", "Description", "MenuId", "CreatedById")
      SELECT v."Code", v."Name", v."Description", menu."Id", adm."Id"
      FROM (VALUES
        ('USR_READ','Leer Usuarios','Permite ver usuarios','USER_MANAGE'),
        ('USR_WRITE','Editar Usuarios','Permite crear/editar usuarios','USER_MANAGE'),
        ('REP_VIEW','Ver Reportes','Permite consultar reportes','REP_KPI'),
        ('CONF_SYS','Configurar Sistema','Permite gestionar configuración','CONF_PARAMS')
      ) AS v("Code","Name","Description","MenuCode")
      LEFT JOIN "Menu" menu ON menu."Code" = v."MenuCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 6) ROLES genéricos de identidad/administración (no ligados al
    // dominio clínico — ver sección "Puente 18+" más abajo para
    // PATIENT_TUTOR/HEALTH_STAFF, que son los que sí tienen permisos
    // sobre pacientes/historial/consentimiento).
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
        ('operador','operador@example.com','Operador','General'),
        ('consulta','consulta@example.com','Usuario','Consulta'),
        ('invitado','invitado@example.com','Guest','User'),
        ('auditor1','auditor1@example.com','Auditor','Uno'),
        ('userstd','userstd@example.com','Usuario','Estandar')
      ) AS v("UserName","Email","FirstName","LastName")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 8) ROLE -> MENU (por Code)
    await queryRunner.query(`
      INSERT INTO "RoleMenu" ("RoleId","MenuId","CreatedById")
      SELECT r."Id", m."Id", adm."Id"
      FROM (
        VALUES
          ('ADMIN','DASH_HOME'),('ADMIN','USER_MANAGE'),('ADMIN','USER_ROLES'),
          ('ADMIN','USER_PERMISSIONS'),('ADMIN','USER_SESSIONS'),
          ('ADMIN','PATIENT_MANAGE'),('ADMIN','PATIENT_GUARDIANS'),
          ('ADMIN','CLINICAL_RECORDS'),('ADMIN','CLINICAL_TRANSITION_FILE'),
          ('ADMIN','CONSENT_AUTHORIZATIONS'),('ADMIN','CONSENT_ACCESS_LOG'),
          ('ADMIN','IPRESS_QUERY'),('ADMIN','IPRESS_FACILITIES'),('ADMIN','IPRESS_STAFF'),
          ('ADMIN','REP_KPI'),('ADMIN','REP_DAILY'),
          ('ADMIN','CONF_PARAMS'),('ADMIN','HELP_FAQ'),('ADMIN','HELP_CONTACT'),
          ('SUP','DASH_HOME'),('SUP','USER_MANAGE'),('SUP','REP_KPI'),('SUP','REP_DAILY'),
          ('OPER','DASH_HOME'),('OPER','REP_KPI'),
          ('CONS','DASH_HOME'),('CONS','REP_KPI'),
          ('GUEST','DASH_HOME'),
          ('AUDIT','DASH_HOME'),
          ('USER','DASH_HOME'),('USER','REP_KPI')
      ) AS v("RoleCode","MenuCode")
      JOIN "Role" r ON r."Code" = v."RoleCode"
      JOIN "Menu" m ON m."Code" = v."MenuCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 9) ROLE -> PERMISSIONS (genéricos, por Code)
    await queryRunner.query(`
      INSERT INTO "RolePermission" ("RoleId","PermissionId","CreatedById")
      SELECT r."Id", p."Id", adm."Id"
      FROM (
        VALUES
          ('ADMIN','USR_READ'),('ADMIN','USR_WRITE'),('ADMIN','REP_VIEW'),('ADMIN','CONF_SYS'),
          ('SUP','USR_READ'),('SUP','REP_VIEW'),
          ('OPER','REP_VIEW'),
          ('CONS','REP_VIEW'),
          ('USER','USR_READ'),('USER','REP_VIEW')
      ) AS v("RoleCode","PermissionCode")
      JOIN "Role" r ON r."Code" = v."RoleCode"
      JOIN "Permission" p ON p."Code" = v."PermissionCode"
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
          ('operador','INSERT','Patient','1','FirstName,LastName'),
          ('consulta','SELECT','Report','N/A','Filters'),
          ('admin','UPDATE','Permission','4','Description'),
          ('supervisor','DELETE','UserRole','7','UserId,RoleId'),
          ('auditor1','SELECT','ClinicalAccessLog','N/A','Filters')
      ) AS x("UserName","Type","TableName","PrimaryKey","AffectedColumns")
      JOIN "User" u ON u."UserName" = x."UserName"
    `);

    // 12) PERMISO "usuarios en línea" (GET /admin/sessions/online) — solo
    // Administrador lo tiene por defecto.
    await queryRunner.query(`
      INSERT INTO "Permission" ("Code", "Name", "Description", "MenuId", "CreatedById")
      SELECT 'ADMIN_VIEW_SESSIONS', 'Ver sesiones activas', 'Permite ver qué usuarios están conectados y desde dónde', menu."Id", adm."Id"
      FROM (SELECT "Id" FROM "Menu" WHERE "Code" = 'USER_SESSIONS') AS menu
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "RolePermission" ("RoleId", "PermissionId", "CreatedById")
      SELECT role."Id", perm."Id", adm."Id"
      FROM (SELECT "Id" FROM "Role" WHERE "Code" = 'ADMIN') AS role
      CROSS JOIN (SELECT "Id" FROM "Permission" WHERE "Code" = 'ADMIN_VIEW_SESSIONS') AS perm
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // Puente 18+ — a partir de acá, todo lo del dominio clínico (ver
    // prompt_contexto_backend_puente18.md). Roles/permisos por Code (no
    // por Id): más seguro que depender del orden exacto de inserción.
    // ============================================================

    // 13) PERMISOS del dominio clínico — cada uno atado a su pantalla
    // real (ver bloque "MENÚS HIJOS" de arriba).
    await queryRunner.query(`
      INSERT INTO "Permission" ("Code", "Name", "Description", "MenuId", "CreatedById")
      SELECT v."Code", v."Name", v."Description", menu."Id", adm."Id"
      FROM (VALUES
        ('PATIENT_READ','Ver pacientes','Permite ver datos demográficos de pacientes','PATIENT_MANAGE'),
        ('PATIENT_WRITE','Gestionar pacientes','Permite crear/editar pacientes y tutores','PATIENT_MANAGE'),
        ('CLINICAL_RECORD_READ','Ver historial clínico','Permite ver diagnósticos, medicación, alergias, cirugías y exámenes','CLINICAL_RECORDS'),
        ('CLINICAL_RECORD_WRITE','Registrar historial clínico','Permite registrar nuevos ítems del historial clínico','CLINICAL_RECORDS'),
        ('CONSENT_MANAGE','Gestionar autorizaciones','Permite otorgar/revocar autorizaciones de acceso a la ficha clínica','CONSENT_AUTHORIZATIONS'),
        ('CONSENT_VIEW','Ver autorizaciones','Permite ver las autorizaciones de acceso vigentes/revocadas','CONSENT_AUTHORIZATIONS'),
        ('IPRESS_QUERY','Consultar ficha clínica (IPRESS)','Permite a un centro de salud consultar el resumen clínico de un paciente','IPRESS_QUERY'),
        ('IPRESS_EMERGENCY_ACCESS','Acceso de emergencia','Permite acceder a información BASICA sin autorización previa por riesgo de vida','IPRESS_QUERY'),
        ('ACCESS_LOG_VIEW','Ver bitácora de accesos','Permite ver quién accedió a la ficha clínica de un paciente y cuándo','CONSENT_ACCESS_LOG')
      ) AS v("Code","Name","Description","MenuCode")
      JOIN "Menu" menu ON menu."Code" = v."MenuCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 14) ROLES del dominio clínico
    await queryRunner.query(`
      INSERT INTO "Role" ("Code", "Name", "Description", "IsSystemRole", "CreatedById")
      SELECT v."Code", v."Name", v."Description", false, adm."Id"
      FROM (VALUES
        ('PATIENT_TUTOR','Paciente / Tutor','Paciente o tutor legal de un paciente menor de edad'),
        ('HEALTH_STAFF','Personal de Salud','Personal clínico de un centro de salud (IPRESS)')
      ) AS v("Code","Name","Description")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 15) ROLE -> PERMISSION del dominio clínico (incluye ADMIN)
    await queryRunner.query(`
      INSERT INTO "RolePermission" ("RoleId","PermissionId","CreatedById")
      SELECT r."Id", p."Id", adm."Id"
      FROM (
        VALUES
          ('ADMIN','PATIENT_READ'), ('ADMIN','PATIENT_WRITE'),
          ('ADMIN','CLINICAL_RECORD_READ'), ('ADMIN','CLINICAL_RECORD_WRITE'),
          ('ADMIN','CONSENT_MANAGE'), ('ADMIN','CONSENT_VIEW'),
          ('ADMIN','IPRESS_QUERY'), ('ADMIN','IPRESS_EMERGENCY_ACCESS'),
          ('ADMIN','ACCESS_LOG_VIEW'),
          ('PATIENT_TUTOR','PATIENT_READ'), ('PATIENT_TUTOR','CONSENT_MANAGE'),
          ('PATIENT_TUTOR','CONSENT_VIEW'), ('PATIENT_TUTOR','ACCESS_LOG_VIEW'),
          ('HEALTH_STAFF','PATIENT_READ'), ('HEALTH_STAFF','PATIENT_WRITE'),
          ('HEALTH_STAFF','CLINICAL_RECORD_READ'), ('HEALTH_STAFF','CLINICAL_RECORD_WRITE'),
          ('HEALTH_STAFF','IPRESS_QUERY'), ('HEALTH_STAFF','IPRESS_EMERGENCY_ACCESS')
      ) AS v("RoleCode","PermissionCode")
      JOIN "Role" r ON r."Code" = v."RoleCode"
      JOIN "Permission" p ON p."Code" = v."PermissionCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 16) ROLE -> MENU del dominio clínico (por Code)
    await queryRunner.query(`
      INSERT INTO "RoleMenu" ("RoleId","MenuId","CreatedById")
      SELECT r."Id", m."Id", adm."Id"
      FROM (
        VALUES
          ('PATIENT_TUTOR','DASH_HOME'),
          ('PATIENT_TUTOR','PATIENT_MANAGE'),
          ('PATIENT_TUTOR','CLINICAL_TRANSITION_FILE'),
          ('PATIENT_TUTOR','CONSENT_AUTHORIZATIONS'),
          ('PATIENT_TUTOR','CONSENT_ACCESS_LOG'),
          ('HEALTH_STAFF','DASH_HOME'),
          ('HEALTH_STAFF','PATIENT_MANAGE'),
          ('HEALTH_STAFF','CLINICAL_RECORDS'),
          ('HEALTH_STAFF','CLINICAL_TRANSITION_FILE'),
          ('HEALTH_STAFF','IPRESS_QUERY')
      ) AS v("RoleCode","MenuCode")
      JOIN "Role" r ON r."Code" = v."RoleCode"
      JOIN "Menu" m ON m."Code" = v."MenuCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 17) IPRESS FICTICIAS (ninguna corresponde a un centro real — nombres
    // deliberadamente genéricos para que no se confundan con INSNSB ni
    // ninguna otra institución existente)
    await queryRunner.query(`
      INSERT INTO "HealthFacility" ("Name","RenhiceCode","FacilityType","Address","CreatedById")
      SELECT v."Name", v."RenhiceCode", v."FacilityType", v."Address", adm."Id"
      FROM (VALUES
        ('IPRESS Pediátrica Ficticia Norte','DEMO-PED-001','PEDIATRICO','Av. Ficticia 100, Lima (demo)'),
        ('Hospital Ficticio Adulto Sur','DEMO-ADU-002','ADULTO','Av. Ficticia 200, Lima (demo)'),
        ('Centro de Salud Ficticio Mixto Este','DEMO-MIX-003','MIXTO','Av. Ficticia 300, Lima (demo)')
      ) AS v("Name","RenhiceCode","FacilityType","Address")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 18) USUARIOS DEMO del dominio clínico (mismo hash/salt de
    // "Passw0rd1!" que el resto del seed).
    await queryRunner.query(`
      INSERT INTO "User"
      ("UserName","Email","FirstName","LastName","PasswordHash","PasswordSalt","SecurityStamp","State","Photo","CreatedAt","CreatedById")
      SELECT
        v."UserName", v."Email", v."FirstName", v."LastName",
        decode('b90efe621fc76a08a09f6e7a9c5c8db958cad73c444208ec5cdb9e99d5aabb90','hex'),
        decode('821eabeec79a13d89640bf8740cab629','hex'),
        gen_random_uuid(), true, '', CURRENT_TIMESTAMP, adm."Id"
      FROM (VALUES
        ('tutor1','tutor1@example.com','Tutor','Ficticio Uno'),
        ('tutor2','tutor2@example.com','Tutor','Ficticio Dos'),
        ('paciente1','paciente1@example.com','Paciente','Ficticio Adulto'),
        ('pediatra1','pediatra1@example.com','Pediatra','Ficticio Uno'),
        ('docadulto','internista1@example.com','Internista','Ficticio Uno')
      ) AS v("UserName","Email","FirstName","LastName")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    await queryRunner.query(`
      INSERT INTO "UserRole" ("UserId","RoleId","CreatedById")
      SELECT u."Id", r."Id", adm."Id"
      FROM (VALUES
        ('tutor1','PATIENT_TUTOR'),
        ('tutor2','PATIENT_TUTOR'),
        ('paciente1','PATIENT_TUTOR'),
        ('pediatra1','HEALTH_STAFF'),
        ('internista1','HEALTH_STAFF')
      ) AS x("UserName","RoleCode")
      JOIN "User" u ON u."UserName" = x."UserName"
      JOIN "Role" r ON r."Code" = x."RoleCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 19) A qué IPRESS pertenece cada usuario de personal de salud —
    // tabla de unión, no una columna en "User" (ver
    // domain/entities/facilities/health-facility-staff.entity.ts).
    await queryRunner.query(`
      INSERT INTO "HealthFacilityStaff" ("UserId","HealthFacilityId","CreatedById")
      SELECT u."Id", fac."Id", adm."Id"
      FROM (VALUES
        ('pediatra1','DEMO-PED-001'),
        ('internista1','DEMO-ADU-002')
      ) AS x("UserName","FacilityCode")
      JOIN "User" u ON u."UserName" = x."UserName"
      JOIN "HealthFacility" fac ON fac."RenhiceCode" = x."FacilityCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 20) PACIENTE A: menor de edad (16 años, calculado desde hoy para que
    // el seed siga siendo válido sin importar cuándo se corra), tutor
    // activo — este es el estado "PRE transición".
    await queryRunner.query(`
      INSERT INTO "Patient" ("DocumentType","DocumentNumber","FirstName","LastName","DateOfBirth","BloodType","UserId","CreatedById")
      SELECT 'DNI','70000001','Paciente','Ficticio Menor', CURRENT_DATE - INTERVAL '16 years', 'O+', NULL, adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "LegalGuardian" ("PatientId","UserId","RelationshipType","IsPrimary","IsActive","CreatedById")
      SELECT p."Id", u."Id", 'MADRE', true, true, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001') AS p
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor1') AS u
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 21) PACIENTE B: ya adulto (19 años), titularidad propia — este es el
    // estado "POST transición": tiene su propio login y su ex-tutor
    // quedó desactivado (simula que TitleTransferService ya corrió).
    await queryRunner.query(`
      INSERT INTO "Patient" ("DocumentType","DocumentNumber","FirstName","LastName","DateOfBirth","BloodType","UserId","CreatedById")
      SELECT 'DNI','70000002','Paciente','Ficticio Adulto', CURRENT_DATE - INTERVAL '19 years', 'A-',
        (SELECT "Id" FROM "User" WHERE "UserName" = 'paciente1'), adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "LegalGuardian" ("PatientId","UserId","RelationshipType","IsPrimary","IsActive","DeactivatedAt","CreatedById")
      SELECT p."Id", u."Id", 'PADRE', true, false, CURRENT_TIMESTAMP, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS p
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor2') AS u
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 22) HISTORIAL CLÍNICO demo — mezcla BASICA/SENSIBLE a propósito para
    // mostrar que la clasificación es por ítem, no por paciente.
    await queryRunner.query(`
      INSERT INTO "ClinicalRecord" ("PatientId","RecordType","SensitivityLevel","Title","Details","OccurredAt","HealthFacilityId","RecordedByUserId","CreatedById")
      SELECT pat."Id", v."RecordType", v."SensitivityLevel", v."Title", v."Details"::jsonb, v."OccurredAt"::date, fac."Id", staff."Id", adm."Id"
      FROM (VALUES
        ('70000001','DIAGNOSTICO','BASICA','Asma bronquial leve','{}', (CURRENT_DATE - INTERVAL '5 years')::text, 'DEMO-PED-001','pediatra1'),
        ('70000001','ALERGIA','BASICA','Alergia a la penicilina','{"severidad":"MODERADA"}', (CURRENT_DATE - INTERVAL '8 years')::text, 'DEMO-PED-001','pediatra1'),
        ('70000001','MEDICACION','BASICA','Salbutamol inhalador','{"dosis":"100mcg","frecuencia":"segun necesidad"}', (CURRENT_DATE - INTERVAL '1 years')::text, 'DEMO-PED-001','pediatra1'),
        ('70000002','DIAGNOSTICO','BASICA','Diabetes tipo 1','{}', (CURRENT_DATE - INTERVAL '10 years')::text, 'DEMO-ADU-002','internista1'),
        ('70000002','DIAGNOSTICO','SENSIBLE','Seguimiento en salud mental','{}', (CURRENT_DATE - INTERVAL '2 years')::text, 'DEMO-ADU-002','internista1')
      ) AS v("DocumentNumber","RecordType","SensitivityLevel","Title","Details","OccurredAt","FacilityCode","StaffUserName")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      JOIN "HealthFacility" fac ON fac."RenhiceCode" = v."FacilityCode"
      JOIN "User" staff ON staff."UserName" = v."StaffUserName"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 23) AUTORIZACIONES DE ACCESO demo
    // Paciente A (menor): su tutor autoriza a la IPRESS Adulto Sur a ver
    // su info BASICA (por si necesita atención de urgencia ahí).
    await queryRunner.query(`
      INSERT INTO "AccessAuthorization" ("PatientId","HealthFacilityId","GrantedByUserId","Scope","Status","GrantedAt","CreatedById")
      SELECT pat."Id", fac."Id", tutor."Id", 'BASICA', 'ACTIVA', CURRENT_TIMESTAMP, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001') AS pat
      CROSS JOIN (SELECT "Id" FROM "HealthFacility" WHERE "RenhiceCode" = 'DEMO-ADU-002') AS fac
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor1') AS tutor
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    // Paciente B (adulto, titular de sí mismo): se autoriza a sí mismo
    // ante la IPRESS Mixta Este con alcance TODA (incluye lo sensible).
    await queryRunner.query(`
      INSERT INTO "AccessAuthorization" ("PatientId","HealthFacilityId","GrantedByUserId","Scope","Status","GrantedAt","CreatedById")
      SELECT pat."Id", fac."Id", pac."Id", 'TODA', 'ACTIVA', CURRENT_TIMESTAMP, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS pat
      CROSS JOIN (SELECT "Id" FROM "HealthFacility" WHERE "RenhiceCode" = 'DEMO-MIX-003') AS fac
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'paciente1') AS pac
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 24) BITÁCORA DE ACCESOS demo — un acceso autorizado, uno de
    // emergencia (sin autorización previa, solo BASICA) y uno denegado
    // (pidieron SENSIBLE sin autorización), para mostrar los 3 caminos de
    // AccessDecisionService.
    await queryRunner.query(`
      INSERT INTO "ClinicalAccessLog" ("PatientId","AccessedByUserId","HealthFacilityId","RequestedScope","Granted","WasEmergencyOverride","DenialReason")
      SELECT pat."Id", staff."Id", fac."Id", v."RequestedScope", v."Granted"::boolean, v."WasEmergencyOverride"::boolean, v."DenialReason"
      FROM (VALUES
        ('70000001','internista1','DEMO-ADU-002','BASICA','true','false',NULL),
        ('70000002','internista1','DEMO-MIX-003','BASICA','true','true','Acceso de emergencia: sin autorización previa vigente'),
        ('70000002','pediatra1','DEMO-PED-001','SENSIBLE','false','false','Sin autorización vigente para información sensible')
      ) AS v("DocumentNumber","StaffUserName","FacilityCode","RequestedScope","Granted","WasEmergencyOverride","DenialReason")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      JOIN "User" staff ON staff."UserName" = v."StaffUserName"
      JOIN "HealthFacility" fac ON fac."RenhiceCode" = v."FacilityCode"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "ClinicalAccessLog"`);
    await queryRunner.query(`DELETE FROM "AccessAuthorization"`);
    await queryRunner.query(`DELETE FROM "ClinicalRecord"`);
    await queryRunner.query(`DELETE FROM "LegalGuardian"`);
    await queryRunner.query(`DELETE FROM "Patient"`);
    await queryRunner.query(`DELETE FROM "HealthFacilityStaff"`);
    await queryRunner.query(`DELETE FROM "HealthFacility"`);
    // "User" nunca se borra de verdad salvo que ya no tenga sesiones
    // referenciándolo (ver FK_UserSession_User, sin ON DELETE CASCADE a
    // propósito) — se limpia primero por si alguien ya inició sesión con
    // estos usuarios demo antes de revertir.
    await queryRunner.query(`
      DELETE FROM "UserSession" WHERE "UserId" IN (
        SELECT "Id" FROM "User" WHERE "UserName" IN ('tutor1','tutor2','paciente1','pediatra1','internista1')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "User" WHERE "UserName" IN ('tutor1','tutor2','paciente1','pediatra1','internista1')
    `);
    await queryRunner.query(`
      DELETE FROM "RolePermission" WHERE "RoleId" IN (
        SELECT "Id" FROM "Role" WHERE "Code" IN ('PATIENT_TUTOR','HEALTH_STAFF')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "RoleMenu" WHERE "RoleId" IN (
        SELECT "Id" FROM "Role" WHERE "Code" IN ('PATIENT_TUTOR','HEALTH_STAFF')
      )
    `);
    await queryRunner.query(
      `DELETE FROM "Role" WHERE "Code" IN ('PATIENT_TUTOR','HEALTH_STAFF')`,
    );
    await queryRunner.query(`
      DELETE FROM "Permission" WHERE "Code" IN (
        'PATIENT_READ','PATIENT_WRITE','CLINICAL_RECORD_READ','CLINICAL_RECORD_WRITE',
        'CONSENT_MANAGE','CONSENT_VIEW','IPRESS_QUERY','IPRESS_EMERGENCY_ACCESS','ACCESS_LOG_VIEW'
      )
    `);
    await queryRunner.query(`
      DELETE FROM "RolePermission" WHERE "PermissionId" = (SELECT "Id" FROM "Permission" WHERE "Code" = 'ADMIN_VIEW_SESSIONS')
    `);
    await queryRunner.query(
      `DELETE FROM "Permission" WHERE "Code" = 'ADMIN_VIEW_SESSIONS'`,
    );
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
