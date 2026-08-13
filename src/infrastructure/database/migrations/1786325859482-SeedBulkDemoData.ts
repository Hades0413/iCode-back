import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Volumen de datos de ejemplo para el dominio de transición
 * pediátrico→adultos (ver CreateTransitionSchema/SeedTransitionData y
 * PUENTE18_FRONTEND_INTEGRATION.md) — a diferencia de esas dos, esto no
 * es la data narrativa "mínima y bien documentada" (los 2 pacientes de
 * ejemplo), es volumen para probar listas, filtros y paginación con más
 * de un caso por estado. Migración propia a propósito, para no inflar
 * SeedTransitionData con 20 pacientes más.
 *
 * 20 pacientes nuevos (70000010-70000019 menores, 70000020-70000029 ya
 * adultos) cubriendo cada estado de "PatientTransition.State" al menos
 * una vez, y ~10 filas en cada tabla de apoyo (guardianes, resúmenes,
 * alertas, avisos, cartas, contenido de "Mi recorrido").
 */
export class SeedBulkDemoData1786325859482 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1) PACIENTES — 10 menores (17a 3m a 17a 11m, cubren PENDING ->
    // IN_PREPARATION -> REFERRED_TO_POST -> APPOINTMENT_IN_PROCESS ->
    // APPOINTMENT_GRANTED según se acercan a los 18) + 10 ya adultos
    // (18a 1m a 19a 6m, cubren FIRST_CARE_DONE/LOST_TO_FOLLOW_UP/
    // READMITTED con distintos estados de la carta).
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "Patient" ("DocumentType","DocumentNumber","FirstName","LastName","DateOfBirth","BloodType","Sex","CreatedById")
      SELECT 'DNI', v."DocumentNumber", v."FirstName", v."LastName",
        CURRENT_DATE - v."Age"::interval, v."BloodType", v."Sex", adm."Id"
      FROM (VALUES
        ('70000010','Valentina','Ficticio M01','17 years 3 months','O+','F'),
        ('70000011','Mateo','Ficticio M02','17 years 4 months','A+','M'),
        ('70000012','Camila','Ficticio M03','17 years 5 months','B+','F'),
        ('70000013','Sebastián','Ficticio M04','17 years 6 months','O-','M'),
        ('70000014','Luciana','Ficticio M05','17 years 7 months','AB+','F'),
        ('70000015','Diego','Ficticio M06','17 years 8 months','A-','M'),
        ('70000016','Antonella','Ficticio M07','17 years 9 months','O+','F'),
        ('70000017','Joaquín','Ficticio M08','17 years 10 months','B-','M'),
        ('70000018','Renata','Ficticio M09','17 years 10 months','O+','F'),
        ('70000019','Emiliano','Ficticio M10','17 years 11 months','AB-','M'),
        ('70000020','Fernanda','Ficticio A01','18 years 1 months','O+','F'),
        ('70000021','Nicolás','Ficticio A02','18 years 3 months','A+','M'),
        ('70000022','Ariana','Ficticio A03','18 years 5 months','B+','F'),
        ('70000023','Gabriel','Ficticio A04','18 years 7 months','O-','M'),
        ('70000024','Isabella','Ficticio A05','18 years 9 months','AB+','F'),
        ('70000025','Rodrigo','Ficticio A06','18 years 11 months','A-','M'),
        ('70000026','Daniela','Ficticio A07','19 years 1 months','O+','F'),
        ('70000027','Bruno','Ficticio A08','19 years 3 months','B-','M'),
        ('70000028','Valeria','Ficticio A09','19 years 5 months','O+','F'),
        ('70000029','Tomás','Ficticio A10','19 years 6 months','AB-','M')
      ) AS v("DocumentNumber","FirstName","LastName","Age","BloodType","Sex")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 2) TUTORES — 10 usuarios nuevos (tutor3..tutor12, mismo hash de
    // "Passw0rd1!" que el resto del seed), uno por cada paciente menor,
    // con el rol ACOMPANANTE (igual que tutor1).
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "User"
      ("UserName","Email","FirstName","LastName","PasswordHash","PasswordSalt","SecurityStamp","State","Photo","CreatedAt","CreatedById")
      SELECT
        v."UserName", v."UserName" || '@example.com', v."FirstName", v."LastName",
        decode('b90efe621fc76a08a09f6e7a9c5c8db958cad73c444208ec5cdb9e99d5aabb90','hex'),
        decode('821eabeec79a13d89640bf8740cab629','hex'),
        gen_random_uuid(), true, '', CURRENT_TIMESTAMP, adm."Id"
      FROM (VALUES
        ('tutor3','Rosa','Ficticio Tres'),
        ('tutor4','Carlos','Ficticio Cuatro'),
        ('tutor5','Elena','Ficticio Cinco'),
        ('tutor6','Jorge','Ficticio Seis'),
        ('tutor7','Marisol','Ficticio Siete'),
        ('tutor8','Raúl','Ficticio Ocho'),
        ('tutor9','Patricia','Ficticio Nueve'),
        ('tutor10','Manuel','Ficticio Diez'),
        ('tutor11','Gloria','Ficticio Once'),
        ('tutor12','Willy','Ficticio Doce')
      ) AS v("UserName","FirstName","LastName")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "UserRole" ("UserId","RoleId","CreatedById")
      SELECT u."Id", r."Id", adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" LIKE 'tutor%' AND "UserName" NOT IN ('tutor1','tutor2')) AS u
      CROSS JOIN (SELECT "Id" FROM "Role" WHERE "Code" = 'ACOMPANANTE') AS r
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 3) TUTELA — un tutor por cada uno de los 10 pacientes menores.
    // tutor9/Antonella queda con "HasJourneyAccess=false" a propósito:
    // variedad sobre el caso de acceso revocado (ver 70000001, que
    // siempre queda con acceso concedido).
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "LegalGuardian" ("PatientId","UserId","RelationshipType","IsPrimary","IsActive","HasJourneyAccess","CreatedById")
      SELECT pat."Id", tut."Id", v."RelationshipType", true, true, v."HasJourneyAccess"::boolean, adm."Id"
      FROM (VALUES
        ('70000010','tutor3','MADRE','true'),
        ('70000011','tutor4','PADRE','true'),
        ('70000012','tutor5','TUTOR_LEGAL','true'),
        ('70000013','tutor6','OTRO','true'),
        ('70000014','tutor7','MADRE','true'),
        ('70000015','tutor8','PADRE','true'),
        ('70000016','tutor9','TUTOR_LEGAL','false'),
        ('70000017','tutor10','OTRO','true'),
        ('70000018','tutor11','MADRE','true'),
        ('70000019','tutor12','PADRE','true')
      ) AS v("DocumentNumber","TutorUserName","RelationshipType","HasJourneyAccess")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      JOIN "User" tut ON tut."UserName" = v."TutorUserName"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 4) PatientTransition — uno por paciente, cubriendo cada estado al
    // menos una vez. Todos atendidos por pediatra1 (mismo criterio que
    // 70000001/70000002 — ver sección 9 del .md sobre por qué no hace
    // falta que la especialidad del caso coincida con la que cubre el
    // staff para que este seed funcione). Sin JSONB acá — se agrega
    // aparte, solo a un par de filas de muestra, en el paso 5.
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "PatientTransition"
        ("PatientId","State","MedicalRecordNumber","PrimaryDiagnosis","SpecialtyId","AttendingStaffId","District",
         "HealthPostFacilityId","HealthPostDistanceKm","ReferredToPostAt","CounterReferralStatus","CreatedById")
      SELECT
        pat."Id", v."State", v."MedicalRecordNumber", v."PrimaryDiagnosis", spec."Id", staff."Id", v."District",
        post."Id", v."HealthPostDistanceKm"::numeric,
        CASE WHEN v."ReferredMonthsAgo" IS NULL THEN NULL
             ELSE CURRENT_TIMESTAMP - (v."ReferredMonthsAgo" || ' months')::interval END,
        v."CounterReferralStatus", adm."Id"
      FROM (VALUES
        -- Menores — progresión PENDING -> APPOINTMENT_GRANTED a medida
        -- que se acercan a los 18 (ver comentario del paso 1 sobre las edades).
        ('70000010','PENDING','HC-300010','Linfoma de Hodgkin en tratamiento','ONCO_PED','Comas',NULL,NULL,NULL,'NONE'),
        ('70000011','PENDING','HC-300011','Arritmia supraventricular controlada','CARDIO_PED','San Juan de Lurigancho',NULL,NULL,NULL,'NONE'),
        ('70000012','IN_PREPARATION','HC-300012','Epilepsia focal en tratamiento','NEURO_PED','Los Olivos',NULL,NULL,NULL,'NONE'),
        ('70000013','IN_PREPARATION','HC-300013','Diabetes mellitus tipo 1 en control','ENDO_PED','Villa El Salvador',NULL,NULL,NULL,'NONE'),
        ('70000014','IN_PREPARATION','HC-300014','Síndrome nefrótico en remisión','NEFRO_PED','Ate',NULL,NULL,NULL,'NONE'),
        ('70000015','REFERRED_TO_POST','HC-300015','Asma persistente moderada','NEUMO_PED','San Juan de Miraflores','DEMO-POST-004','4.2','1','NONE'),
        ('70000016','REFERRED_TO_POST','HC-300016','Anemia hemolítica autoinmune','HEMATO_PED','Independencia','DEMO-POST-004','6.0','1','NONE'),
        ('70000017','APPOINTMENT_IN_PROCESS','HC-300017','Artritis idiopática juvenil poliarticular','REUMATO_PED','Carabayllo','DEMO-POST-004','2.8','1','NONE'),
        ('70000018','APPOINTMENT_GRANTED','HC-300018','Tumor de Wilms operado','ONCO_PED','Puente Piedra','DEMO-POST-004','5.5','2','NONE'),
        ('70000019','APPOINTMENT_GRANTED','HC-300019','Cardiopatía congénita en seguimiento','CARDIO_PED','Villa María del Triunfo','DEMO-POST-004','3.1','2','NONE'),
        -- Adultos — ya cumplieron 18; distintos estados de la carta de
        -- contrarreferencia (ver paso 8: 1 sin subir, 4 subida, 5 enviada).
        ('70000020','FIRST_CARE_DONE','HC-300020','Hipotiroidismo congénito','ENDO_PED','Comas','DEMO-POST-004','4.0','6','NONE'),
        ('70000021','FIRST_CARE_DONE','HC-300021','Insuficiencia renal crónica estadio 2','NEFRO_PED','San Juan de Lurigancho','DEMO-POST-004','5.2','7','UPLOADED'),
        ('70000022','FIRST_CARE_DONE','HC-300022','Fibrosis quística en seguimiento','NEUMO_PED','Los Olivos','DEMO-POST-004','3.6','8','UPLOADED'),
        ('70000023','FIRST_CARE_DONE','HC-300023','Hemofilia tipo A leve','HEMATO_PED','Villa El Salvador','DEMO-POST-004','4.8','9','UPLOADED'),
        ('70000024','FIRST_CARE_DONE','HC-300024','Lupus eritematoso sistémico juvenil','REUMATO_PED','Ate','DEMO-POST-004','6.3','10','SENT'),
        ('70000025','FIRST_CARE_DONE','HC-300025','Leucemia linfoblástica aguda en remisión','ONCO_PED','San Juan de Miraflores','DEMO-POST-004','2.1','11','SENT'),
        ('70000026','FIRST_CARE_DONE','HC-300026','Cardiopatía congénita en seguimiento','CARDIO_PED','Independencia','DEMO-POST-004','5.9','12','SENT'),
        ('70000027','LOST_TO_FOLLOW_UP','HC-300027','Parálisis cerebral leve','NEURO_PED','Carabayllo','DEMO-POST-004','4.4','13','SENT'),
        ('70000028','READMITTED','HC-300028','Diabetes mellitus tipo 1 en control','ENDO_PED','Puente Piedra','DEMO-POST-004','3.3','7','UPLOADED'),
        ('70000029','FIRST_CARE_DONE','HC-300029','Síndrome nefrótico en remisión','NEFRO_PED','Villa María del Triunfo','DEMO-POST-004','5.0','14','SENT')
      ) AS v("DocumentNumber","State","MedicalRecordNumber","PrimaryDiagnosis","SpecialtyCode","District",
             "HealthPostCode","HealthPostDistanceKm","ReferredMonthsAgo","CounterReferralStatus")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      JOIN "MedicalSpecialty" spec ON spec."Code" = v."SpecialtyCode"
      LEFT JOIN "HealthFacility" post ON post."RenhiceCode" = v."HealthPostCode"
      CROSS JOIN (SELECT "Id" FROM "HealthFacilityStaff" WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1')) AS staff
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 5) Detalle de derivación/cita — solo en 2 filas de muestra (una
    // menor todavía en el proceso, una adulta ya con el recorrido
    // completo), mismo criterio que el "::jsonb" del 70000002 original
    // (paréntesis alrededor de TODA la concatenación antes del cast).
    // ============================================================
    await queryRunner.query(`
      UPDATE "PatientTransition" SET
        "HospitalReferral" = ('{"hospital":"Hospital Ficticio Adulto Sur","specialty":"Oncología","doctor":"Internista Ficticio Uno","referredAt":"' || to_char(CURRENT_TIMESTAMP - INTERVAL '2 months', 'YYYY-MM-DD') || '"}')::jsonb,
        "Appointment" = ('{"hospital":"Hospital Ficticio Adulto Sur","specialist":"Internista Ficticio Uno","date":"' || to_char(CURRENT_TIMESTAMP + INTERVAL '1 month', 'YYYY-MM-DD') || 'T10:00:00","reason":"Primera cita en adultos","managedBy":"Posta Ficticia San Juan de Lurigancho"}')::jsonb,
        "AppointmentAddress" = 'Hospital Ficticio Adulto Sur, Av. Ficticia 200, Lima (demo)',
        "ArriveMinutesEarly" = 20
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000018')
    `);
    await queryRunner.query(`
      UPDATE "PatientTransition" SET
        "HospitalReferral" = ('{"hospital":"Hospital Ficticio Adulto Sur","specialty":"Reumatología","doctor":"Internista Ficticio Uno","referredAt":"' || to_char(CURRENT_TIMESTAMP - INTERVAL '10 months', 'YYYY-MM-DD') || '"}')::jsonb,
        "Appointment" = ('{"hospital":"Hospital Ficticio Adulto Sur","specialist":"Internista Ficticio Uno","date":"' || to_char(CURRENT_TIMESTAMP - INTERVAL '9 months', 'YYYY-MM-DD') || 'T09:00:00","reason":"Control post-transición","managedBy":"Posta Ficticia San Juan de Lurigancho"}')::jsonb,
        "AppointmentAddress" = 'Hospital Ficticio Adulto Sur, Av. Ficticia 200, Lima (demo)',
        "ArriveMinutesEarly" = 15,
        "AdmissionNote" = 'Llevar DNI y el carnet de citas — preséntate en Admisión, segundo piso.'
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000024')
    `);

    // ============================================================
    // 6) Historia clínica de transferencia — una por cada menor (5
    // DRAFT, todavía sin firmar; 5 APPROVED, ya firmadas), sections
    // acortadas a 3 en vez de las 6 del ejemplo original para no
    // repetir tanto texto en 10 filas.
    // ============================================================
    const minorSummaries: Array<[string, string, string, string]> = [
      ['70000010', 'DRAFT', 'Valentina', 'Linfoma de Hodgkin en tratamiento'],
      ['70000011', 'DRAFT', 'Mateo', 'Arritmia supraventricular controlada'],
      ['70000012', 'DRAFT', 'Camila', 'Epilepsia focal en tratamiento'],
      ['70000013', 'DRAFT', 'Sebastián', 'Diabetes mellitus tipo 1 en control'],
      ['70000014', 'DRAFT', 'Luciana', 'Síndrome nefrótico en remisión'],
      ['70000015', 'APPROVED', 'Diego', 'Asma persistente moderada'],
      // 70000016 queda A PROPÓSITO sin ninguna fila acá ("NONE" — todavía
      // ni el borrador se generó): es de los 4 dentro de la ventana real
      // de 3 meses (ENABLED_MONTHS_BEFORE_18 en transition.rules.ts del
      // front, distinto del "9 meses" que dice el copy de la pantalla) y
      // hace falta al menos uno "sin generar" para que el KPI "Sin
      // historia clínica firmada" no quede en 0.
      [
        '70000017',
        'DRAFT',
        'Joaquín',
        'Artritis idiopática juvenil poliarticular',
      ],
      ['70000018', 'APPROVED', 'Renata', 'Tumor de Wilms operado'],
      [
        '70000019',
        'APPROVED',
        'Emiliano',
        'Cardiopatía congénita en seguimiento',
      ],
    ];
    for (const [doc, status, name, diagnosis] of minorSummaries) {
      const sections = JSON.stringify([
        {
          id: 'identificacion',
          title: 'Identificación',
          body: `${name}, DNI ${doc}.`,
          hint: '',
        },
        {
          id: 'diagnostico',
          title: 'Diagnóstico',
          body: diagnosis + '.',
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
          ("PatientId","Status","Sections","PendingChecks","DraftedByKind","DraftedByName","DraftedAt","EditedById","EditedAt","CreatedById")
        SELECT pat."Id", '${status}', '${sections}'::jsonb, '[]'::jsonb, 'AI', 'Generador IA (plantilla server-side)',
          CURRENT_TIMESTAMP - INTERVAL '10 days', ped."Id", CURRENT_TIMESTAMP - INTERVAL '7 days', adm."Id"
        FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '${doc}') AS pat
        CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1') AS ped
        CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
      `);
      if (status === 'APPROVED') {
        await queryRunner.query(`
          UPDATE "TransitionSummary" SET "ApprovedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1'),
            "ApprovedAt" = CURRENT_TIMESTAMP - INTERVAL '5 days'
          WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '${doc}')
        `);
      }
    }

    // ============================================================
    // 7) Reclamos del especialista + avisos a la posta — uno de cada
    // por adulto (mismo criterio que el reclamo/aviso de 70000002).
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "ReferralAlert" ("PatientId","Reason","SentAt","SentById","CreatedById")
      SELECT pat."Id", v."Reason", CURRENT_TIMESTAMP - (v."MonthsAgo" || ' months')::interval, ped."Id", adm."Id"
      FROM (VALUES
        ('70000020','POST_NOTICE','6'),('70000021','COUNTER_REFERRAL','7'),('70000022','RESCHEDULE','8'),
        ('70000023','POST_NOTICE','9'),('70000024','COUNTER_REFERRAL','10'),('70000025','RESCHEDULE','11'),
        ('70000026','POST_NOTICE','12'),('70000027','COUNTER_REFERRAL','13'),('70000028','RESCHEDULE','7'),
        ('70000029','POST_NOTICE','14')
      ) AS v("DocumentNumber","Reason","MonthsAgo")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1') AS ped
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "PostNotice" ("PatientId","SentAt","SentById","CreatedById")
      SELECT pat."Id", CURRENT_TIMESTAMP - (v."MonthsAgo" || ' months')::interval, ref."Id", adm."Id"
      FROM (VALUES
        ('70000020','6'),('70000021','7'),('70000022','8'),('70000023','9'),('70000024','10'),
        ('70000025','11'),('70000026','12'),('70000027','13'),('70000028','7'),('70000029','14')
      ) AS v("DocumentNumber","MonthsAgo")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'referencias1') AS ref
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 8) Carta de contrarreferencia — 1 adulto sin subir todavía
    // ("NONE", no entra en este INSERT porque esa fila no existe), 4
    // subidas sin enviar, 5 ya enviadas.
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "CounterReferral"
        ("PatientId","Status","FileName","Format","FileSize","StoragePath","Code","UploadedById","UploadedAt","SentById","SentAt","CreatedById")
      SELECT
        pat."Id", v."Status", 'carta-contrarreferencia-' || v."DocumentNumber" || '.pdf', 'PDF', 240000,
        'counter-referrals/' || v."DocumentNumber" || '/carta-contrarreferencia.pdf', v."Code",
        ref."Id", CURRENT_TIMESTAMP - (v."UploadedMonthsAgo" || ' months')::interval,
        CASE WHEN v."Status" = 'SENT' THEN ref."Id" ELSE NULL END,
        CASE WHEN v."Status" = 'SENT' THEN CURRENT_TIMESTAMP - (v."SentMonthsAgo" || ' months')::interval ELSE NULL END,
        adm."Id"
      FROM (VALUES
        ('70000021','UPLOADED','CR-2026-00043','6',NULL),
        ('70000022','UPLOADED','CR-2026-00044','7',NULL),
        ('70000023','UPLOADED','CR-2026-00045','8',NULL),
        ('70000028','UPLOADED','CR-2026-00046','6',NULL),
        ('70000024','SENT','CR-2026-00047','9','8'),
        ('70000025','SENT','CR-2026-00048','10','9'),
        ('70000026','SENT','CR-2026-00049','11','10'),
        ('70000027','SENT','CR-2026-00050','12','11'),
        ('70000029','SENT','CR-2026-00051','13','12')
      ) AS v("DocumentNumber","Status","Code","UploadedMonthsAgo","SentMonthsAgo")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'referencias1') AS ref
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 9) "Mi recorrido" de los 10 menores — checklist en 5, medicación
    // + alergia en los otros 5, un contacto y un mensaje del propio
    // tutor en todos.
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "JourneyChecklistItem" ("PatientId","Title","Detail","PendingLabel","Done","DisplayOrder","CreatedById")
      SELECT pat."Id", v."Title", v."Detail", v."PendingLabel", v."Done"::boolean, v."DisplayOrder"::int, adm."Id"
      FROM (VALUES
        ('70000010','Guardar mi historia clínica','Pedile a tu médico una copia cuando esté firmada.','Falta que se firme',false,1),
        ('70000010','Anotar mis medicamentos','Llevá la lista a cada consulta nueva.','Pendiente',false,2),
        ('70000012','Guardar el teléfono de la posta','Por si necesitás reprogramar la cita.','Pendiente',false,1),
        ('70000012','Preparar mis documentos','DNI y carnet de citas.','Pendiente',false,2),
        ('70000014','Guardar mi historia clínica','Pedile a tu médico una copia cuando esté firmada.','Falta que se firme',false,1),
        ('70000014','Confirmar la dirección de la posta','Verificá que sea la más cercana a tu casa.','Pendiente',true,2),
        ('70000016','Anotar mis medicamentos','Llevá la lista a cada consulta nueva.','Pendiente',false,1),
        ('70000016','Guardar el teléfono de la posta','Por si necesitás reprogramar la cita.','Pendiente',true,2),
        ('70000018','Guardar mi historia clínica','Ya está firmada — guardala en un lugar seguro.',NULL,true,1),
        ('70000018','Preparar mis documentos','DNI y carnet de citas.','Pendiente',false,2)
      ) AS v("DocumentNumber","Title","Detail","PendingLabel","Done","DisplayOrder")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyMedication" ("PatientId","Initial","Name","Dose","Purpose","DisplayOrder","CreatedById")
      SELECT pat."Id", v."Initial", v."Name", v."Dose", v."Purpose", v."DisplayOrder"::int, adm."Id"
      FROM (VALUES
        ('70000011','P','Propranolol','10mg cada 12h','Controlar el ritmo cardíaco',1),
        ('70000011','A','Ácido acetilsalicílico','100mg una vez al día','Prevención',2),
        ('70000013','I','Insulina glargina','Según esquema indicado','Control de glucosa',1),
        ('70000013','M','Metformina','500mg con la cena','Sensibilidad a la insulina',2),
        ('70000015','S','Salmeterol/Fluticasona inhalador','Dos puffs cada 12h','Control de base',1),
        ('70000015','S','Salbutamol inhalador','Según necesidad','Rescate',2),
        ('70000017','M','Metotrexato','Una vez por semana','Control de la inflamación',1),
        ('70000017','A','Ácido fólico','1mg, día siguiente al metotrexato','Reducir efectos secundarios',2),
        ('70000019','E','Enalapril','5mg una vez al día','Soporte cardíaco',1),
        ('70000019','F','Furosemida','20mg según indicación','Control de líquidos',2)
      ) AS v("DocumentNumber","Initial","Name","Dose","Purpose","DisplayOrder")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyAllergy" ("PatientId","Substance","Detail","DisplayOrder","CreatedById")
      SELECT pat."Id", v."Substance", v."Detail", v."DisplayOrder"::int, adm."Id"
      FROM (VALUES
        ('70000011','Ibuprofeno','Reacción cutánea',1),
        ('70000011','Polen','Rinitis estacional',2),
        ('70000013','Mariscos','Reacción leve',1),
        ('70000013','Látex','Contacto con guantes',2),
        ('70000015','Ácaros del polvo','Desencadena crisis de asma',1),
        ('70000015','Polen de gramíneas','Estacional',2),
        ('70000017','Sulfas','Reacción cutánea',1),
        ('70000017','Níquel','Dermatitis de contacto',2),
        ('70000019','Penicilina','Reacción moderada',1),
        ('70000019','Aspirina','Evitar por tratamiento cardíaco',2)
      ) AS v("DocumentNumber","Substance","Detail","DisplayOrder")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyContact" ("PatientId","Role","Name","Detail","DisplayOrder","CreatedById")
      SELECT pat."Id", 'Especialista', 'Pediatra Ficticio Uno', '01-500-0001', 1, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (
        '70000010','70000011','70000012','70000013','70000014',
        '70000015','70000016','70000017','70000018','70000019'
      )) AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyMessage" ("PatientId","Text","SentById","SentAt","CreatedById")
      SELECT pat."Id", 'Hola, no te olvides de llevar tu carnet a la próxima cita.', tut."Id",
        CURRENT_TIMESTAMP - INTERVAL '3 days', adm."Id"
      FROM (VALUES
        ('70000010','tutor3'),('70000011','tutor4'),('70000012','tutor5'),('70000013','tutor6'),
        ('70000014','tutor7'),('70000015','tutor8'),('70000016','tutor9'),('70000017','tutor10'),
        ('70000018','tutor11'),('70000019','tutor12')
      ) AS v("DocumentNumber","TutorUserName")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      JOIN "User" tut ON tut."UserName" = v."TutorUserName"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 10) 18 menores más (70000030-70000047), TODOS dentro de la ventana
    // real de 3 meses (ENABLED_MONTHS_BEFORE_18) y SIN historia aprobada
    // — junto con 70000016/70000017 del paso 6, completan 20 casos reales
    // de "Sin historia clínica firmada" (9 sin generar + 9 en borrador).
    // Sin guardián ni contenido de "Mi recorrido": no hacen falta para
    // este KPI, que solo mira PatientTransition + TransitionSummary.
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "Patient" ("DocumentType","DocumentNumber","FirstName","LastName","DateOfBirth","BloodType","Sex","CreatedById")
      SELECT 'DNI', v."DocumentNumber", v."FirstName", v."LastName",
        CURRENT_DATE - v."Age"::interval, v."BloodType", v."Sex", adm."Id"
      FROM (VALUES
        ('70000030','Ximena','Ficticio V01','17 years 9 months','O+','F'),
        ('70000031','Adrián','Ficticio V02','17 years 10 months','A+','M'),
        ('70000032','Paula','Ficticio V03','17 years 11 months','B+','F'),
        ('70000033','Iker','Ficticio V04','17 years 9 months','O-','M'),
        ('70000034','Mariana','Ficticio V05','17 years 10 months','AB+','F'),
        ('70000035','Santiago','Ficticio V06','17 years 11 months','A-','M'),
        ('70000036','Abril','Ficticio V07','17 years 9 months','O+','F'),
        ('70000037','Máximo','Ficticio V08','17 years 10 months','B-','M'),
        ('70000038','Constanza','Ficticio V09','17 years 11 months','O+','F'),
        ('70000039','Agustín','Ficticio V10','17 years 9 months','AB-','M'),
        ('70000040','Julieta','Ficticio V11','17 years 10 months','O+','F'),
        ('70000041','Thiago','Ficticio V12','17 years 11 months','A+','M'),
        ('70000042','Milagros','Ficticio V13','17 years 9 months','B+','F'),
        ('70000043','Benjamín','Ficticio V14','17 years 10 months','O-','M'),
        ('70000044','Alessandra','Ficticio V15','17 years 11 months','AB+','F'),
        ('70000045','Cristóbal','Ficticio V16','17 years 9 months','A-','M'),
        ('70000046','Zoe','Ficticio V17','17 years 10 months','O+','F'),
        ('70000047','Ignacio','Ficticio V18','17 years 11 months','B-','M')
      ) AS v("DocumentNumber","FirstName","LastName","Age","BloodType","Sex")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "PatientTransition"
        ("PatientId","State","MedicalRecordNumber","PrimaryDiagnosis","SpecialtyId","AttendingStaffId","District","CounterReferralStatus","CreatedById")
      SELECT pat."Id", v."State", v."MedicalRecordNumber", v."PrimaryDiagnosis", spec."Id", staff."Id", v."District", 'NONE', adm."Id"
      FROM (VALUES
        -- Los primeros 9 todavía no tienen ni el borrador ("sin generar").
        ('70000030','PENDING','HC-300030','Leucemia linfoblástica aguda en remisión','ONCO_PED','Comas'),
        ('70000031','PENDING','HC-300031','Arritmia supraventricular controlada','CARDIO_PED','San Juan de Lurigancho'),
        ('70000032','PENDING','HC-300032','Epilepsia focal en tratamiento','NEURO_PED','Los Olivos'),
        ('70000033','PENDING','HC-300033','Diabetes mellitus tipo 1 en control','ENDO_PED','Villa El Salvador'),
        ('70000034','PENDING','HC-300034','Síndrome nefrótico en remisión','NEFRO_PED','Ate'),
        ('70000035','PENDING','HC-300035','Asma persistente moderada','NEUMO_PED','San Juan de Miraflores'),
        ('70000036','PENDING','HC-300036','Anemia hemolítica autoinmune','HEMATO_PED','Independencia'),
        ('70000037','PENDING','HC-300037','Artritis idiopática juvenil poliarticular','REUMATO_PED','Carabayllo'),
        ('70000038','PENDING','HC-300038','Tumor de Wilms operado','ONCO_PED','Puente Piedra'),
        -- Los últimos 9 ya tienen un borrador de la IA, esperando la firma.
        ('70000039','IN_PREPARATION','HC-300039','Cardiopatía congénita en seguimiento','CARDIO_PED','Villa María del Triunfo'),
        ('70000040','IN_PREPARATION','HC-300040','Parálisis cerebral leve','NEURO_PED','Comas'),
        ('70000041','IN_PREPARATION','HC-300041','Hipotiroidismo congénito','ENDO_PED','San Juan de Lurigancho'),
        ('70000042','IN_PREPARATION','HC-300042','Insuficiencia renal crónica estadio 2','NEFRO_PED','Los Olivos'),
        ('70000043','IN_PREPARATION','HC-300043','Fibrosis quística en seguimiento','NEUMO_PED','Villa El Salvador'),
        ('70000044','IN_PREPARATION','HC-300044','Hemofilia tipo A leve','HEMATO_PED','Ate'),
        ('70000045','IN_PREPARATION','HC-300045','Lupus eritematoso sistémico juvenil','REUMATO_PED','San Juan de Miraflores'),
        ('70000046','IN_PREPARATION','HC-300046','Linfoma de Hodgkin en tratamiento','ONCO_PED','Independencia'),
        ('70000047','IN_PREPARATION','HC-300047','Arritmia supraventricular controlada','CARDIO_PED','Carabayllo')
      ) AS v("DocumentNumber","State","MedicalRecordNumber","PrimaryDiagnosis","SpecialtyCode","District")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      JOIN "MedicalSpecialty" spec ON spec."Code" = v."SpecialtyCode"
      CROSS JOIN (SELECT "Id" FROM "HealthFacilityStaff" WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1')) AS staff
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    const draftDocs = Array.from({ length: 9 }, (_, i) => `700000${39 + i}`);
    for (const doc of draftDocs) {
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
        SELECT pat."Id", 'DRAFT', '${sections}'::jsonb, '[]'::jsonb, 'AI', 'Generador IA (plantilla server-side)',
          CURRENT_TIMESTAMP - INTERVAL '2 days', adm."Id"
        FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '${doc}') AS pat
        CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const minorDocs = Array.from({ length: 10 }, (_, i) => `7000001${i}`);
    const adultDocs = Array.from({ length: 10 }, (_, i) => `7000002${i}`);
    const windowDocs = Array.from({ length: 18 }, (_, i) => `700000${30 + i}`);
    const allDocs = [...minorDocs, ...adultDocs, ...windowDocs]
      .map((d) => `'${d}'`)
      .join(',');
    const guardianUsers = Array.from(
      { length: 10 },
      (_, i) => `'tutor${i + 3}'`,
    ).join(',');

    await queryRunner.query(`
      DELETE FROM "JourneyMessage" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "JourneyContact" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "JourneyAllergy" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "JourneyMedication" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "JourneyChecklistItem" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "CounterReferral" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "PostNotice" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "ReferralAlert" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "TransitionSummary" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "PatientTransition" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "LegalGuardian" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${allDocs}))
    `);
    await queryRunner.query(
      `DELETE FROM "Patient" WHERE "DocumentNumber" IN (${allDocs})`,
    );
    await queryRunner.query(`
      DELETE FROM "UserRole" WHERE "UserId" IN (SELECT "Id" FROM "User" WHERE "UserName" IN (${guardianUsers}))
    `);
    await queryRunner.query(
      `DELETE FROM "User" WHERE "UserName" IN (${guardianUsers})`,
    );
  }
}
