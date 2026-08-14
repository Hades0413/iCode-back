import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dos gestos nuevos, propios del paciente, en "Mi recorrido":
 *
 * 1. Autoregistrar una cita que consiguió por su cuenta (sin esperar a
 *    que la posta se la consiga) — reutiliza la misma columna jsonb
 *    "Appointment" que ya existía (ver CreateTransitionSchema), solo
 *    cambia quién puede escribirla y qué trae "managedBy".
 * 2. Generar un código único para que, en la consulta, el médico lo
 *    escanee (o lo tipee) y vea su historia clínica de transferencia sin
 *    que el paciente tenga que decir su documento en voz alta.
 *
 * "ConsultationCode" es columna propia (no jsonb) porque necesita ser
 * único y buscable — es la clave por la que "TransitionSummariesController"
 * resuelve qué paciente es, el mismo criterio que ya usa "MedicalRecordNumber".
 */
export class AddPatientSelfService1786325860482 implements MigrationInterface {
  name = 'AddPatientSelfService1786325860482';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "PatientTransition" ADD COLUMN "ConsultationCode" varchar(10) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "PatientTransition"
        ADD CONSTRAINT "UQ_PatientTransition_ConsultationCode" UNIQUE ("ConsultationCode")
    `);
    await queryRunner.query(`
      ALTER TABLE "PatientTransition" ADD COLUMN "ConsultationCodeGeneratedAt" timestamp(6) NULL
    `);

    await queryRunner.query(`
      INSERT INTO "Permission" ("Code","Name","Description","MenuId","CreatedById")
      SELECT code, name, description, NULL, (SELECT "Id" FROM "User" WHERE "UserName" = 'admin')
      FROM (VALUES
        ('APPOINTMENT_SELF_REPORT','Autoregistrar mi cita','Permite al paciente titular registrar una cita que consiguió por su cuenta, antes de que la posta le asigne una'),
        ('CONSULTATION_CODE_MANAGE','Generar mi código de consulta','Permite al paciente titular generar el código único que un médico usa para ver su resumen clínico')
      ) AS v(code, name, description)
    `);

    await queryRunner.query(`
      INSERT INTO "RolePermission" ("RoleId","PermissionId","CreatedById")
      SELECT r."Id", p."Id", (SELECT "Id" FROM "User" WHERE "UserName" = 'admin')
      FROM (VALUES
        ('ADMIN','APPOINTMENT_SELF_REPORT'),('ADMIN','CONSULTATION_CODE_MANAGE'),
        ('PACIENTE_TITULAR','APPOINTMENT_SELF_REPORT'),('PACIENTE_TITULAR','CONSULTATION_CODE_MANAGE')
      ) AS v(roleCode, permCode)
      JOIN "Role" r ON r."Code" = v.roleCode
      JOIN "Permission" p ON p."Code" = v.permCode
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "RolePermission" WHERE "PermissionId" IN (
        SELECT "Id" FROM "Permission" WHERE "Code" IN ('APPOINTMENT_SELF_REPORT','CONSULTATION_CODE_MANAGE')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "Permission" WHERE "Code" IN ('APPOINTMENT_SELF_REPORT','CONSULTATION_CODE_MANAGE')
    `);

    await queryRunner.query(`
      ALTER TABLE "PatientTransition" DROP COLUMN "ConsultationCodeGeneratedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "PatientTransition" DROP CONSTRAINT "UQ_PatientTransition_ConsultationCode"
    `);
    await queryRunner.query(`
      ALTER TABLE "PatientTransition" DROP COLUMN "ConsultationCode"
    `);
  }
}
