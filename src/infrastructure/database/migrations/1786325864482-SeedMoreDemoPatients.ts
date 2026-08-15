import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Segunda tanda de volumen, continuando la numeración de
 * SeedBulkDemoData (70000010-70000047) — 20 pacientes más
 * (70000048-70000057 menores, 70000058-70000067 ya adultos), cada uno
 * con su "PatientTransition" y su "TransitionSummary". A propósito más
 * angosta que SeedBulkDemoData (sin guardianes/referencias/
 * contrarreferencias/"Mi recorrido"): esta tanda existe para probar el
 * pipeline de deploy automático de principio a fin (push -> cron ->
 * migración en prod -> reinicio), no para sumar más casos narrativos.
 */
export class SeedMoreDemoPatients1786325864482
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1) PACIENTES — 10 menores (17a 1m a 17a 10m) + 10 adultos
    // (18a 2m a 20a).
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "Patient" ("DocumentType","DocumentNumber","FirstName","LastName","DateOfBirth","BloodType","Sex","CreatedById")
      SELECT 'DNI', v."DocumentNumber", v."FirstName", v."LastName",
        CURRENT_DATE - v."Age"::interval, v."BloodType", v."Sex", adm."Id"
      FROM (VALUES
        ('70000048','Aitana','Ficticio W01','17 years 1 months','O+','F'),
        ('70000049','Leandro','Ficticio W02','17 years 2 months','A+','M'),
        ('70000050','Emilia','Ficticio W03','17 years 3 months','B+','F'),
        ('70000051','Dante','Ficticio W04','17 years 4 months','O-','M'),
        ('70000052','Catalina','Ficticio W05','17 years 5 months','AB+','F'),
        ('70000053','Ian','Ficticio W06','17 years 6 months','A-','M'),
        ('70000054','Martina','Ficticio W07','17 years 7 months','O+','F'),
        ('70000055','Lucas','Ficticio W08','17 years 8 months','B-','M'),
        ('70000056','Amanda','Ficticio W09','17 years 9 months','O+','F'),
        ('70000057','Gael','Ficticio W10','17 years 10 months','AB-','M'),
        ('70000058','Regina','Ficticio B01','18 years 2 months','O+','F'),
        ('70000059','Máximo','Ficticio B02','18 years 4 months','A+','M'),
        ('70000060','Alma','Ficticio B03','18 years 6 months','B+','F'),
        ('70000061','Emiliano','Ficticio B04','18 years 8 months','O-','M'),
        ('70000062','Victoria','Ficticio B05','18 years 10 months','AB+','F'),
        ('70000063','Simón','Ficticio B06','19 years 0 months','A-','M'),
        ('70000064','Josefina','Ficticio B07','19 years 4 months','O+','F'),
        ('70000065','Elías','Ficticio B08','19 years 8 months','B-','M'),
        ('70000066','Antonia','Ficticio B09','19 years 11 months','O+','F'),
        ('70000067','Pedro','Ficticio B10','20 years 0 months','AB-','M')
      ) AS v("DocumentNumber","FirstName","LastName","Age","BloodType","Sex")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 2) PatientTransition — uno por paciente, cubriendo cada estado
    // otra vez (misma distribución que SeedBulkDemoData, otro lote).
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "PatientTransition"
        ("PatientId","State","MedicalRecordNumber","PrimaryDiagnosis","SpecialtyId","AttendingStaffId","District","CounterReferralStatus","CreatedById")
      SELECT pat."Id", v."State", v."MedicalRecordNumber", v."PrimaryDiagnosis", spec."Id", staff."Id", v."District", v."CounterReferralStatus", adm."Id"
      FROM (VALUES
        ('70000048','PENDING','HC-400048','Asma persistente moderada','NEUMO_PED','Comas','NONE'),
        ('70000049','PENDING','HC-400049','Epilepsia focal en tratamiento','NEURO_PED','San Juan de Lurigancho','NONE'),
        ('70000050','IN_PREPARATION','HC-400050','Diabetes mellitus tipo 1 en control','ENDO_PED','Los Olivos','NONE'),
        ('70000051','IN_PREPARATION','HC-400051','Síndrome nefrótico en remisión','NEFRO_PED','Villa El Salvador','NONE'),
        ('70000052','IN_PREPARATION','HC-400052','Anemia hemolítica autoinmune','HEMATO_PED','Ate','NONE'),
        ('70000053','REFERRED_TO_POST','HC-400053','Artritis idiopática juvenil poliarticular','REUMATO_PED','San Juan de Miraflores','NONE'),
        ('70000054','REFERRED_TO_POST','HC-400054','Linfoma de Hodgkin en tratamiento','ONCO_PED','Independencia','NONE'),
        ('70000055','APPOINTMENT_IN_PROCESS','HC-400055','Arritmia supraventricular controlada','CARDIO_PED','Carabayllo','NONE'),
        ('70000056','APPOINTMENT_GRANTED','HC-400056','Tumor de Wilms operado','ONCO_PED','Puente Piedra','NONE'),
        ('70000057','APPOINTMENT_GRANTED','HC-400057','Cardiopatía congénita en seguimiento','CARDIO_PED','Villa María del Triunfo','NONE'),
        ('70000058','FIRST_CARE_DONE','HC-400058','Hipotiroidismo congénito','ENDO_PED','Comas','NONE'),
        ('70000059','FIRST_CARE_DONE','HC-400059','Insuficiencia renal crónica estadio 2','NEFRO_PED','San Juan de Lurigancho','UPLOADED'),
        ('70000060','FIRST_CARE_DONE','HC-400060','Fibrosis quística en seguimiento','NEUMO_PED','Los Olivos','UPLOADED'),
        ('70000061','FIRST_CARE_DONE','HC-400061','Hemofilia tipo A leve','HEMATO_PED','Villa El Salvador','UPLOADED'),
        ('70000062','FIRST_CARE_DONE','HC-400062','Lupus eritematoso sistémico juvenil','REUMATO_PED','Ate','SENT'),
        ('70000063','FIRST_CARE_DONE','HC-400063','Leucemia linfoblástica aguda en remisión','ONCO_PED','San Juan de Miraflores','SENT'),
        ('70000064','FIRST_CARE_DONE','HC-400064','Cardiopatía congénita en seguimiento','CARDIO_PED','Independencia','SENT'),
        ('70000065','LOST_TO_FOLLOW_UP','HC-400065','Parálisis cerebral leve','NEURO_PED','Carabayllo','SENT'),
        ('70000066','READMITTED','HC-400066','Diabetes mellitus tipo 1 en control','ENDO_PED','Puente Piedra','UPLOADED'),
        ('70000067','FIRST_CARE_DONE','HC-400067','Síndrome nefrótico en remisión','NEFRO_PED','Villa María del Triunfo','SENT')
      ) AS v("DocumentNumber","State","MedicalRecordNumber","PrimaryDiagnosis","SpecialtyCode","District","CounterReferralStatus")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      JOIN "MedicalSpecialty" spec ON spec."Code" = v."SpecialtyCode"
      CROSS JOIN (SELECT "Id" FROM "HealthFacilityStaff" WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1')) AS staff
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 3) TransitionSummary — una por paciente (10 DRAFT, 10 APPROVED),
    // secciones acortadas como en SeedBulkDemoData.
    // ============================================================
    const docs = Array.from({ length: 20 }, (_, i) => `700000${48 + i}`);
    for (const [index, doc] of docs.entries()) {
      const status = index % 2 === 0 ? 'DRAFT' : 'APPROVED';
      const sections = JSON.stringify([
        {
          id: 'identificacion',
          title: 'Identificación',
          body: `DNI ${doc}.`,
          hint: '',
        },
        {
          id: 'diagnostico',
          title: 'Diagnóstico',
          body: 'Ver ficha del paciente.',
          hint: '',
        },
        {
          id: 'plan',
          title: 'Plan',
          body: 'Continuar el seguimiento en el hospital de adultos que le asigne la posta.',
          hint: '',
        },
      ]).replaceAll("'", "''");
      await queryRunner.query(`
        INSERT INTO "TransitionSummary"
          ("PatientId","Status","Sections","PendingChecks","DraftedByKind","DraftedByName","DraftedAt","CreatedById")
        SELECT pat."Id", '${status}', '${sections}'::jsonb, '[]'::jsonb, 'AI', 'Generador IA (plantilla server-side)',
          CURRENT_TIMESTAMP - INTERVAL '1 day', adm."Id"
        FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '${doc}') AS pat
        CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
      `);
      if (status === 'APPROVED') {
        await queryRunner.query(`
          UPDATE "TransitionSummary" SET "ApprovedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1'),
            "ApprovedAt" = CURRENT_TIMESTAMP
          WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '${doc}')
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const docs = Array.from({ length: 20 }, (_, i) => `'700000${48 + i}'`).join(
      ',',
    );

    await queryRunner.query(`
      DELETE FROM "TransitionSummary" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${docs}))
    `);
    await queryRunner.query(`
      DELETE FROM "PatientTransition" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${docs}))
    `);
    await queryRunner.query(
      `DELETE FROM "Patient" WHERE "DocumentNumber" IN (${docs})`,
    );
  }
}
