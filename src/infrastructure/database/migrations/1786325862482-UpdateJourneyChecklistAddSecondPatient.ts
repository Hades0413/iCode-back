import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dos cambios en "Mi recorrido" (ver SeedTransitionData, sección 14/14b):
 *
 * 1. El checklist de preparación pasa de 3 a 4 ítems, con texto nuevo —
 *    ver mockup "Tus pasos" (aprenderte tus medicamentos, llevar tu DNI,
 *    anotar tus preguntas, saber decir tu alergia). "PendingLabel" no es
 *    un genérico "Pendiente": es el fragmento que arma la frase de arriba
 *    ("Te falta aprenderte tus dosis, llevar tu DNI..." — ver
 *    domain/rules/journey.rules.ts#pendingSentence de iCode-front), por
 *    eso va en minúscula y en la forma verbal exacta.
 * 2. Un segundo paciente con login propio (paciente2/70000003), sin cita
 *    todavía — para poder ver "Mi recorrido" en el estado en que el botón
 *    de autoregistrar cita (AppointmentReportCard) tiene sentido. 70000001
 *    también carece de cita, pero se ve desde un tutor (role GUARDIAN):
 *    ese botón solo lo ve el propio titular (role OWNER, ver
 *    canReportAppointment de iCode-front) — 70000002 es titular pero YA
 *    tiene cita. Ningún paciente existente cubría esa combinación.
 *
 * SeedTransitionData (1786325858482) ya corrió en un ambiente compartido
 * — no se edita en el lugar, se corrige acá (ver migrations/README.md).
 */
export class UpdateJourneyChecklistAddSecondPatient1786325862482 implements MigrationInterface {
  name = 'UpdateJourneyChecklistAddSecondPatient1786325862482';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Checklist de 70000002 (paciente1) — se reemplazan los 3 ítems
    // viejos por los 4 nuevos. Ya pasó la primera atención, así que 3 de
    // los 4 quedan marcados y solo "anotar tus preguntas" pendiente.
    await queryRunner.query(`
      DELETE FROM "JourneyChecklistItem"
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyChecklistItem" ("PatientId","Title","Detail","PendingLabel","Done","DisplayOrder","CreatedById")
      SELECT pat."Id", v."Title", v."Detail", v."PendingLabel", v."Done"::boolean, v."DisplayOrder"::int, adm."Id"
      FROM (VALUES
        ('70000002','Aprenderte tus medicamentos','Saber decir qué tomas, cuánto y a qué hora, sin mirar el papel. En el hospital de adultos te lo van a preguntar a ti, no a tu mamá.',NULL,true,1),
        ('70000002','Llevar tu DNI','Sin el documento no te pueden registrar en admisión.',NULL,true,2),
        ('70000002','Anotar tus preguntas','Lo que quieras preguntar en la consulta. Escríbelo antes: adentro se olvida.','anotar tus preguntas',false,3),
        ('70000002','Saber decir tu alergia','Penicilina. Decirlo antes de cualquier antibiótico.',NULL,true,4)
      ) AS v("DocumentNumber","Title","Detail","PendingLabel","Done","DisplayOrder")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 2) Usuario + paciente nuevo: adulto, titularidad propia, sin cita
    // todavía (mismo hash/salt de "Passw0rd1!" que el resto del seed).
    await queryRunner.query(`
      INSERT INTO "User"
      ("UserName","Email","FirstName","LastName","PasswordHash","PasswordSalt","SecurityStamp","State","Photo","CreatedAt","CreatedById")
      SELECT
        'paciente2','paciente2@example.com','Paciente','Ficticio Adulto Dos',
        decode('b90efe621fc76a08a09f6e7a9c5c8db958cad73c444208ec5cdb9e99d5aabb90','hex'),
        decode('821eabeec79a13d89640bf8740cab629','hex'),
        gen_random_uuid(), true, '', CURRENT_TIMESTAMP, adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "UserRole" ("UserId","RoleId","CreatedById")
      SELECT u."Id", r."Id", adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'paciente2') AS u
      CROSS JOIN (SELECT "Id" FROM "Role" WHERE "Code" = 'PACIENTE_TITULAR') AS r
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "Patient" ("DocumentType","DocumentNumber","FirstName","LastName","DateOfBirth","BloodType","Sex","UserId","CreatedById")
      SELECT 'DNI','70000003','Paciente','Ficticio Adulto Dos', CURRENT_DATE - INTERVAL '20 years', 'O-', 'F',
        (SELECT "Id" FROM "User" WHERE "UserName" = 'paciente2'), adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 3) Su transición: ya la posta lo derivó a un hospital, pero todavía
    // no le consiguió la cita ("Appointment" queda NULL a propósito).
    await queryRunner.query(`
      INSERT INTO "PatientTransition"
        ("PatientId","State","MedicalRecordNumber","PrimaryDiagnosis","SpecialtyId","AttendingStaffId","District",
         "HealthPostFacilityId","HealthPostDistanceKm","ReferredToPostAt","HospitalReferral","CreatedById")
      SELECT
        pat."Id", 'APPOINTMENT_IN_PROCESS', 'HC-205501', 'Hipotiroidismo congénito en seguimiento', spec."Id", staff."Id", 'San Juan de Lurigancho',
        post."Id", 4.2, CURRENT_TIMESTAMP - INTERVAL '2 months',
        ('{"hospital":"Hospital Ficticio Adulto Sur","specialty":"Endocrinología","doctor":null,"referredAt":"' || to_char(CURRENT_TIMESTAMP - INTERVAL '2 months', 'YYYY-MM-DD') || '"}')::jsonb,
        adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000003') AS pat
      CROSS JOIN (SELECT "Id" FROM "MedicalSpecialty" WHERE "Code" = 'ENDO_PED') AS spec
      CROSS JOIN (SELECT "Id" FROM "HealthFacilityStaff" WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1')) AS staff
      CROSS JOIN (SELECT "Id" FROM "HealthFacility" WHERE "RenhiceCode" = 'DEMO-POST-004') AS post
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 4) "Mi recorrido" de 70000003 — mismos 4 ítems que 70000002, pero
    // recién arrancando: ninguno marcado todavía.
    await queryRunner.query(`
      INSERT INTO "JourneyChecklistItem" ("PatientId","Title","Detail","PendingLabel","Done","DisplayOrder","CreatedById")
      SELECT pat."Id", v."Title", v."Detail", v."PendingLabel", v."Done"::boolean, v."DisplayOrder"::int, adm."Id"
      FROM (VALUES
        ('70000003','Aprenderte tus medicamentos','Saber decir qué tomas, cuánto y a qué hora, sin mirar el papel. En el hospital de adultos te lo van a preguntar a ti, no a tu mamá.','aprenderte tus dosis',false,1),
        ('70000003','Llevar tu DNI','Sin el documento no te pueden registrar en admisión.','llevar tu DNI',false,2),
        ('70000003','Anotar tus preguntas','Lo que quieras preguntar en la consulta. Escríbelo antes: adentro se olvida.','anotar tus preguntas',false,3),
        ('70000003','Saber decir tu alergia','Penicilina. Decirlo antes de cualquier antibiótico.','saber decir tu alergia',false,4)
      ) AS v("DocumentNumber","Title","Detail","PendingLabel","Done","DisplayOrder")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyContact" ("PatientId","Role","Name","Detail","DisplayOrder","CreatedById")
      SELECT pat."Id", 'Posta asignada', 'Posta Ficticia San Juan de Lurigancho', '01-500-0004', 1, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000003') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "JourneyContact" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000003')
    `);
    await queryRunner.query(`
      DELETE FROM "JourneyChecklistItem" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000003')
    `);
    await queryRunner.query(`
      DELETE FROM "PatientTransition" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000003')
    `);
    await queryRunner.query(
      `DELETE FROM "Patient" WHERE "DocumentNumber" = '70000003'`,
    );
    await queryRunner.query(`
      DELETE FROM "UserRole" WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'paciente2')
    `);
    await queryRunner.query(
      `DELETE FROM "User" WHERE "UserName" = 'paciente2'`,
    );

    await queryRunner.query(`
      DELETE FROM "JourneyChecklistItem"
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyChecklistItem" ("PatientId","Title","Detail","PendingLabel","Done","DisplayOrder","CreatedById")
      SELECT pat."Id", v."Title", v."Detail", v."PendingLabel", v."Done"::boolean, v."DisplayOrder"::int, adm."Id"
      FROM (VALUES
        ('70000002','Guardar mi historia clínica','Ya está firmada — guardala en un lugar seguro.',NULL,true,1),
        ('70000002','Anotar mis medicamentos','Llevá la lista a cada consulta nueva.',NULL,true,2),
        ('70000002','Anotar mis preguntas para el especialista','Lo que quieras preguntar en la próxima consulta.','Pendiente',false,3)
      ) AS v("DocumentNumber","Title","Detail","PendingLabel","Done","DisplayOrder")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
  }
}
