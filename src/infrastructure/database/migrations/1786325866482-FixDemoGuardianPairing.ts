import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Empareja al tutor de la demo con el paciente de la demo.
 *
 * Los dos perfiles de "Mi recorrido" que ofrece el ingreso del prototipo
 * (`demoProfiles` de iCode-front: "Soy el paciente" = `paciente1`, "Acompaño
 * a un paciente" = `tutor1`) estaban sobre **pacientes distintos**:
 *
 * - `tutor1` acompañaba a 70000001, el menor de 16 — que no tiene login
 *   propio, así que del otro lado no había nadie que pudiera leer nada.
 * - `paciente1` es titular de 70000002, cuyo único tutor activo era `tutor3`
 *   (lo sumó AddActiveGuardianToPatient2 solo para que la pestaña "Yo"
 *   tuviera un tutor que mostrar).
 *
 * Efecto visible: el tutor escribía un recordatorio, el POST devolvía 201 y
 * el mensaje se guardaba… en el recorrido de 70000001. El paciente entraba y
 * no veía nada, porque el suyo era otro. No era un bug del código —
 * JourneyService guarda y lee bien— sino de a quién apunta cada usuario de
 * demo.
 *
 * Lo que se hace acá:
 *
 * 1. `tutor1` pasa a acompañar a 70000002, activo y primario: ahora el par
 *    "paciente1 + tutor1" es un solo caso mirado desde los dos lados, que es
 *    lo que la pantalla de ingreso viene prometiendo.
 * 2. Se retira a `tutor3` de 70000002 — su lugar lo ocupa `tutor1`, y de paso
 *    `tutor3` vuelve a tener un solo paciente (70000010). Tener dos vínculos
 *    activos lo dejaba a merced de cuál devolviera primero el `findOne` de
 *    JourneyService.
 * 3. El menor 70000001 no se queda sin tutor: lo toma `tutor2` (el padre que
 *    ya existía en el seed), y se le da el rol ACOMPANANTE para que esa vista
 *    —un tutor mirando el recorrido de un menor— siga siendo visitable con la
 *    contraseña de siempre.
 * 4. Los recordatorios que `tutor1` ya había mandado se mudan con él, así el
 *    paciente encuentra algo en la bandeja apenas entra en vez de tener que
 *    pedir uno nuevo para comprobar que ahora sí llega.
 *
 * SeedInitialData y AddActiveGuardianToPatient2 ya corrieron en ambientes
 * compartidos — no se editan en el lugar, se corrigen acá (ver
 * migrations/README.md).
 */
export class FixDemoGuardianPairing1786325866482 implements MigrationInterface {
  name = 'FixDemoGuardianPairing1786325866482';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1) Los recordatorios de tutor1 se mudan al paciente que ahora
    // acompaña. Va primero: después de mover el vínculo ya no habría
    // cómo saber cuáles eran suyos.
    // ============================================================
    await queryRunner.query(`
      UPDATE "JourneyMessage"
      SET "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001')
        AND "SentById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor1')
    `);

    // ============================================================
    // 2) tutor1 deja de acompañar al menor y pasa a acompañar a
    // 70000002 (el paciente de paciente1).
    // ============================================================
    await queryRunner.query(`
      DELETE FROM "LegalGuardian"
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001')
        AND "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor1')
    `);
    // El ex-tutor desactivado deja de ser el primario: el primario es
    // quien representa hoy, y las consultas de JourneyService buscan
    // "IsActive AND IsPrimary" — dos filas primarias en el mismo
    // paciente es una ambigüedad esperando a que alguien la encuentre.
    await queryRunner.query(`
      UPDATE "LegalGuardian"
      SET "IsPrimary" = false,
          "UpdatedAt" = CURRENT_TIMESTAMP,
          "UpdatedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'admin')
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
        AND "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor2')
    `);
    await queryRunner.query(`
      INSERT INTO "LegalGuardian" ("PatientId","UserId","RelationshipType","IsPrimary","IsActive","HasJourneyAccess","CreatedById")
      SELECT pat."Id", tut."Id", 'MADRE', true, true, true, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor1') AS tut
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 3) tutor3 vuelve a tener un solo paciente (70000010).
    // ============================================================
    await queryRunner.query(`
      DELETE FROM "LegalGuardian"
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
        AND "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor3')
    `);

    // ============================================================
    // 4) El menor 70000001 queda con tutor2, que además necesita el
    // rol ACOMPANANTE para poder abrir "Mi recorrido".
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "LegalGuardian" ("PatientId","UserId","RelationshipType","IsPrimary","IsActive","HasJourneyAccess","CreatedById")
      SELECT pat."Id", tut."Id", 'PADRE', true, true, true, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor2') AS tut
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "UserRole" ("UserId","RoleId","CreatedById")
      SELECT u."Id", r."Id", adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor2') AS u
      CROSS JOIN (SELECT "Id" FROM "Role" WHERE "Code" = 'ACOMPANANTE') AS r
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
      WHERE NOT EXISTS (
        SELECT 1 FROM "UserRole" ur
        WHERE ur."UserId" = u."Id" AND ur."RoleId" = r."Id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "UserRole"
      WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor2')
        AND "RoleId" = (SELECT "Id" FROM "Role" WHERE "Code" = 'ACOMPANANTE')
    `);
    await queryRunner.query(`
      DELETE FROM "LegalGuardian"
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001')
        AND "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor2')
    `);

    // tutor3 vuelve a ser el tutor activo de 70000002 (como lo dejó
    // AddActiveGuardianToPatient2: secundario, no primario).
    await queryRunner.query(`
      INSERT INTO "LegalGuardian" ("PatientId","UserId","RelationshipType","IsPrimary","IsActive","HasJourneyAccess","CreatedById")
      SELECT pat."Id", tut."Id", 'MADRE', false, true, true, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor3') AS tut
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      DELETE FROM "LegalGuardian"
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
        AND "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor1')
    `);
    await queryRunner.query(`
      UPDATE "LegalGuardian"
      SET "IsPrimary" = true,
          "UpdatedAt" = CURRENT_TIMESTAMP,
          "UpdatedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'admin')
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
        AND "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor2')
    `);
    await queryRunner.query(`
      INSERT INTO "LegalGuardian" ("PatientId","UserId","RelationshipType","IsPrimary","IsActive","HasJourneyAccess","CreatedById")
      SELECT pat."Id", tut."Id", 'MADRE', true, true, true, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor1') AS tut
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    await queryRunner.query(`
      UPDATE "JourneyMessage"
      SET "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001')
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
        AND "SentById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor1')
    `);
  }
}
