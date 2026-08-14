import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Para poder ver la pestaña "Yo" de "Mi recorrido" con un tutor activo de
 * verdad (la tarjeta "Quién ve tu información" + "Quitarle el acceso...",
 * ver GuardianAccessCard de iCode-front) hace falta un paciente que sea a
 * la vez (a) titular con login propio (role OWNER) y (b) tenga un
 * "LegalGuardian" con "IsActive=true" — ninguno de los pacientes
 * existentes cumplía las dos: 70000001 no tiene login propio (se ve desde
 * GUARDIAN, que no ve esta tarjeta), y el único tutor de 70000002
 * (tutor2/padre) ya quedó "IsActive=false" a propósito, simulando que
 * "TitleTransferService" ya corrió para él (ver SeedInitialData).
 *
 * Solución: sumarle a 70000002 un SEGUNDO guardián activo — reutiliza
 * "tutor3"/Rosa, que ya existe desde SeedBulkDemoData (ahí es tutora de
 * 70000010, sin login propio) — no se toca al primero (tutor2 sigue
 * "IsActive=false", la tabla admite varios tutores por paciente, ver
 * "UQ_LegalGuardian_Patient_User"). Como no es "IsPrimary", la consulta
 * de JourneyService (`isActive AND isPrimary` primero, si no hay cae a
 * "isActive` solo) lo encuentra igual — ver JourneyService.buildGrantedResponse.
 */
export class AddActiveGuardianToPatient21786325863482 implements MigrationInterface {
  name = 'AddActiveGuardianToPatient21786325863482';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "LegalGuardian" ("PatientId","UserId","RelationshipType","IsPrimary","IsActive","HasJourneyAccess","CreatedById")
      SELECT pat."Id", tut."Id", 'MADRE', false, true, true, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor3') AS tut
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "LegalGuardian"
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
        AND "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor3')
    `);
  }
}
