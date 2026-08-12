import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Datos de arranque para el dominio de transición pediátrico→adultos
 * (ver CreateTransitionSchema y PUENTE18_FRONTEND_INTEGRATION.md).
 * Reutiliza deliberadamente los usuarios y los dos pacientes ficticios
 * que ya sembró SeedInitialData (70000001 = menor con tutor activo,
 * 70000002 = adulto con titularidad propia) en vez de inventar otros
 * nuevos — son exactamente los "dos estados de la transición" que ese
 * seed ya documenta, y ahora también sirven para este dominio.
 */
export class SeedTransitionData1786325858482 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // ALTER: la posta del distrito no es "PEDIATRICO"/"ADULTO"/"MIXTO"
    // (esos tres son perfiles de IPRESS que atiende, la posta es primer
    // nivel) — se ensancha el CHECK original en vez de crear un catálogo
    // aparte, reutilizando "HealthFacility" tal como se documentó en
    // PUENTE18_FRONTEND_INTEGRATION.md.
    // ============================================================
    await queryRunner.query(
      `ALTER TABLE "HealthFacility" DROP CONSTRAINT "CK_HealthFacility_FacilityType"`,
    );
    await queryRunner.query(`
      ALTER TABLE "HealthFacility" ADD CONSTRAINT "CK_HealthFacility_FacilityType"
        CHECK ("FacilityType" IN ('PEDIATRICO','ADULTO','MIXTO','POSTA'))
    `);

    // 0) Sexo de los dos pacientes demo — dato de identidad genuino que
    // SeedInitialData no pedía todavía (ver Patient.Sex,
    // PUENTE18_FRONTEND_INTEGRATION.md). El front lo declara no-nulo.
    await queryRunner.query(`
      UPDATE "Patient" SET "Sex" = 'M' WHERE "DocumentNumber" = '70000001'
    `);
    await queryRunner.query(`
      UPDATE "Patient" SET "Sex" = 'M' WHERE "DocumentNumber" = '70000002'
    `);

    // 1) ESPECIALIDADES MÉDICAS (catálogo). "AdultName" es la etiqueta que
    // corresponde mostrar cuando el paciente ya cumplió 18 (ver
    // domain/entities/facilities/medical-specialty.entity.ts) — nunca se
    // crea una segunda fila de catálogo ni se reasigna
    // "PatientTransition.SpecialtyId": el nombre efectivo lo calcula
    // PatientTransitionService a partir de "isAdult", igual que el resto
    // de este dominio.
    await queryRunner.query(`
      INSERT INTO "MedicalSpecialty" ("Code","Name","AdultName","CreatedById")
      SELECT v."Code", v."Name", v."AdultName", adm."Id"
      FROM (VALUES
        ('ONCO_PED','Oncología pediátrica','Oncología de adultos'),
        ('CARDIO_PED','Cardiología pediátrica','Cardiología de adultos'),
        ('NEURO_PED','Neurología pediátrica','Neurología de adultos'),
        ('ENDO_PED','Endocrinología pediátrica','Endocrinología de adultos'),
        ('NEFRO_PED','Nefrología pediátrica','Nefrología de adultos'),
        ('NEUMO_PED','Neumología pediátrica','Neumología de adultos'),
        ('HEMATO_PED','Hematología pediátrica','Hematología de adultos'),
        ('REUMATO_PED','Reumatología pediátrica','Reumatología de adultos')
      ) AS v("Code","Name","AdultName")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 2) PERMISOS nuevos — MenuId NULL: estas pantallas viven en
    // iCode-front, no en el menú de administración de este backend (ver
    // PUENTE18_FRONTEND_INTEGRATION.md, sección 1).
    await queryRunner.query(`
      INSERT INTO "Permission" ("Code","Name","Description","MenuId","CreatedById")
      SELECT v."Code", v."Name", v."Description", NULL, adm."Id"
      FROM (VALUES
        -- Deliberadamente DISTINTO de "PATIENT_READ" (que ya existía para
        -- el dominio de consentimiento, ver migrations/README.md): ese
        -- permiso lo tienen tutores/pacientes para leer SU propio
        -- paciente puntual — si el tablero del especialista también
        -- aceptara "PATIENT_READ", cualquier tutor vería la cohorte
        -- ENTERA de otros pacientes, no solo la suya. Verificado con un
        -- Postgres real (ver PUENTE18_FRONTEND_INTEGRATION.md, sección 9).
        ('PATIENT_COHORT_READ','Ver la cohorte de pacientes en tutela','Permite ver el tablero del especialista — todos los pacientes en tutela, no uno puntual'),
        ('REPORT_READ','Ver panel post-transición','Permite ver el panel de seguimiento de pacientes que ya cumplieron 18'),
        ('REFERRAL_READ','Ver bandejas de referencias','Permite ver las bandejas de avisos y contrarreferencias del área'),
        ('REFERRAL_AREA_NOTIFY','Reclamar al área de referencias','Permite al especialista reclamarle al área que avise a la posta o mande la carta'),
        ('HEALTH_POST_NOTIFY','Avisar a la posta','Permite registrar el aviso a la posta del distrito'),
        ('COUNTER_REFERRAL_MANAGE','Gestionar carta de contrarreferencia','Permite subir y enviar la carta de contrarreferencia'),
        ('JOURNEY_READ','Ver mi recorrido','Permite ver el recorrido de transición propio o del paciente que se acompaña'),
        ('CHECKLIST_WRITE','Marcar checklist de preparación','Permite tildar los ítems de preparación — solo el paciente titular'),
        ('GUARDIAN_REMIND','Enviar recordatorio','Permite a quien acompaña mandarle un recordatorio al paciente'),
        ('GUARDIAN_ACCESS_MANAGE','Gestionar acceso del tutor al recorrido','Permite al paciente titular dar o quitar acceso a su recorrido')
      ) AS v("Code","Name","Description")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 3) ROLES nuevos
    await queryRunner.query(`
      INSERT INTO "Role" ("Code","Name","Description","IsSystemRole","CreatedById")
      SELECT v."Code", v."Name", v."Description", false, adm."Id"
      FROM (VALUES
        ('ESPECIALISTA_PEDIATRIA','Especialista de Pediatría','Consultorio del INSN: prepara y firma la historia clínica de transferencia'),
        ('AREA_REFERENCIAS','Área de Referencias y Contrarreferencias','Avisa a la posta y gestiona la carta de contrarreferencia'),
        ('PACIENTE_TITULAR','Paciente (titular del recorrido)','Ve y gestiona su propio recorrido de transición'),
        ('ACOMPANANTE','Tutor que acompaña','Acompaña el recorrido de transición de un paciente menor')
      ) AS v("Code","Name","Description")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 4) ROLE -> PERMISSION (incluye ADMIN, que recibe todos los nuevos)
    await queryRunner.query(`
      INSERT INTO "RolePermission" ("RoleId","PermissionId","CreatedById")
      SELECT r."Id", p."Id", adm."Id"
      FROM (
        VALUES
          ('ADMIN','PATIENT_COHORT_READ'),
          ('ADMIN','REPORT_READ'),('ADMIN','REFERRAL_READ'),('ADMIN','REFERRAL_AREA_NOTIFY'),
          ('ADMIN','HEALTH_POST_NOTIFY'),('ADMIN','COUNTER_REFERRAL_MANAGE'),('ADMIN','JOURNEY_READ'),
          ('ADMIN','CHECKLIST_WRITE'),('ADMIN','GUARDIAN_REMIND'),('ADMIN','GUARDIAN_ACCESS_MANAGE'),
          ('ESPECIALISTA_PEDIATRIA','PATIENT_COHORT_READ'),
          ('ESPECIALISTA_PEDIATRIA','PATIENT_READ'),('ESPECIALISTA_PEDIATRIA','PATIENT_WRITE'),
          ('ESPECIALISTA_PEDIATRIA','REPORT_READ'),('ESPECIALISTA_PEDIATRIA','REFERRAL_AREA_NOTIFY'),
          ('AREA_REFERENCIAS','PATIENT_READ'),('AREA_REFERENCIAS','REFERRAL_READ'),
          ('AREA_REFERENCIAS','HEALTH_POST_NOTIFY'),('AREA_REFERENCIAS','COUNTER_REFERRAL_MANAGE'),
          ('PACIENTE_TITULAR','JOURNEY_READ'),('PACIENTE_TITULAR','CHECKLIST_WRITE'),
          ('PACIENTE_TITULAR','GUARDIAN_ACCESS_MANAGE'),
          ('ACOMPANANTE','JOURNEY_READ'),('ACOMPANANTE','GUARDIAN_REMIND'),
          -- 'operador' (rol OPER, ya existía en SeedInitialData) ve el
          -- tablero y el panel pero no puede actuar sobre ningún caso —
          -- para probar que las acciones desaparecen sin el permiso y que
          -- el servidor las rechazaría igual con 403. Nunca tuvo un uso
          -- legítimo para "PATIENT_READ" puntual (eso es del dominio de
          -- consentimiento) — por eso acá solo lleva el de cohorte.
          ('OPER','PATIENT_COHORT_READ'),('OPER','REPORT_READ')
      ) AS v("RoleCode","PermissionCode")
      JOIN "Role" r ON r."Code" = v."RoleCode"
      JOIN "Permission" p ON p."Code" = v."PermissionCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 5) USUARIO DEMO nuevo: el área de Referencias y Contrarreferencias
    // (los otros roles se apoyan en usuarios que YA existen —
    // pediatra1/paciente1/tutor1 del seed clínico— porque son la misma
    // persona vista desde otro dominio, no alguien distinto).
    await queryRunner.query(`
      INSERT INTO "User"
      ("UserName","Email","FirstName","LastName","PasswordHash","PasswordSalt","SecurityStamp","State","Photo","CreatedAt","CreatedById")
      SELECT
        'referencias1','referencias1@example.com','Referencias','Ficticio Uno',
        decode('b90efe621fc76a08a09f6e7a9c5c8db958cad73c444208ec5cdb9e99d5aabb90','hex'),
        decode('821eabeec79a13d89640bf8740cab629','hex'),
        gen_random_uuid(), true, '', CURRENT_TIMESTAMP, adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 5b) Usuario demo DESACTIVADO — el caso "loguea con la contraseña
    // correcta pero el servidor igual contesta 401" (SessionAuthGuard
    // invalida por State=false). No es lo mismo que 'system' de
    // SeedInitialData: ese tiene un hash de relleno, nunca autenticaría
    // con "Passw0rd1!" — este sí tiene el hash real, para poder probar el
    // caso de verdad con la contraseña de siempre.
    await queryRunner.query(`
      INSERT INTO "User"
      ("UserName","Email","FirstName","LastName","PasswordHash","PasswordSalt","SecurityStamp","State","Photo","CreatedAt","CreatedById")
      SELECT
        'inactivo1','inactivo1@example.com','Especialista','Desactivado Ficticio',
        decode('b90efe621fc76a08a09f6e7a9c5c8db958cad73c444208ec5cdb9e99d5aabb90','hex'),
        decode('821eabeec79a13d89640bf8740cab629','hex'),
        gen_random_uuid(), false, '', CURRENT_TIMESTAMP, adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "UserRole" ("UserId","RoleId","CreatedById")
      SELECT u."Id", r."Id", adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'inactivo1') AS u
      CROSS JOIN (SELECT "Id" FROM "Role" WHERE "Code" = 'ESPECIALISTA_PEDIATRIA') AS r
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 5c) Usuario demo SIN ROL — el botón de acceso rápido "sinpermisos"
    // de la pantalla de login del front (iCode-front/src/presentation/
    // pages/login.page.tsx) ya lo anuncia con el hint "recibe 403 en la
    // lista": loguea bien, pero al no tener ningún "UserRole" no tiene
    // ningún permiso — sirve para probar que el back rechaza con 403,
    // no solo que el front oculta el botón.
    await queryRunner.query(`
      INSERT INTO "User"
      ("UserName","Email","FirstName","LastName","PasswordHash","PasswordSalt","SecurityStamp","State","Photo","CreatedAt","CreatedById")
      SELECT
        'sinpermisos','sinpermisos@example.com','Sin Permisos','Ficticio',
        decode('b90efe621fc76a08a09f6e7a9c5c8db958cad73c444208ec5cdb9e99d5aabb90','hex'),
        decode('821eabeec79a13d89640bf8740cab629','hex'),
        gen_random_uuid(), true, '', CURRENT_TIMESTAMP, adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 6) ROLES nuevos sobre usuarios existentes + el usuario nuevo
    await queryRunner.query(`
      INSERT INTO "UserRole" ("UserId","RoleId","CreatedById")
      SELECT u."Id", r."Id", adm."Id"
      FROM (VALUES
        ('pediatra1','ESPECIALISTA_PEDIATRIA'),
        ('referencias1','AREA_REFERENCIAS'),
        ('paciente1','PACIENTE_TITULAR'),
        ('tutor1','ACOMPANANTE')
      ) AS x("UserName","RoleCode")
      JOIN "User" u ON u."UserName" = x."UserName"
      JOIN "Role" r ON r."Code" = x."RoleCode"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 7) A qué especialidad(es) cubre pediatra1
    await queryRunner.query(`
      INSERT INTO "HealthFacilityStaffSpecialty" ("HealthFacilityStaffId","MedicalSpecialtyId","CreatedById")
      SELECT staff."Id", spec."Id", adm."Id"
      FROM (SELECT "Id" FROM "HealthFacilityStaff" WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1')) AS staff
      CROSS JOIN (SELECT "Id" FROM "MedicalSpecialty" WHERE "Code" = 'ONCO_PED') AS spec
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 8) La posta ficticia del distrito + a qué IPRESS pertenece
    // referencias1 (el área es del propio INSN — ver
    // PUENTE18_FRONTEND_INTEGRATION.md, pregunta abierta ya resuelta acá).
    await queryRunner.query(`
      INSERT INTO "HealthFacility" ("Name","RenhiceCode","FacilityType","Address","District","CreatedById")
      SELECT 'Posta Ficticia San Juan de Lurigancho','DEMO-POST-004','POSTA','Av. Ficticia 400, SJL (demo)','San Juan de Lurigancho', adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "HealthFacilityStaff" ("UserId","HealthFacilityId","CreatedById")
      SELECT u."Id", fac."Id", adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" = 'referencias1') AS u
      CROSS JOIN (SELECT "Id" FROM "HealthFacility" WHERE "RenhiceCode" = 'DEMO-PED-001') AS fac
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 9) PatientTransition — 70000001 (menor, 16a, todavía PENDING: a más
    // de 3 meses de los 18, ni la historia ni el aviso a la posta están
    // habilitados todavía).
    await queryRunner.query(`
      INSERT INTO "PatientTransition"
        ("PatientId","State","MedicalRecordNumber","PrimaryDiagnosis","SpecialtyId","AttendingStaffId","District","CreatedById")
      SELECT pat."Id", 'PENDING', 'HC-198442', 'Leucemia linfoblástica aguda en remisión', spec."Id", staff."Id", 'Comas', adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001') AS pat
      CROSS JOIN (SELECT "Id" FROM "MedicalSpecialty" WHERE "Code" = 'ONCO_PED') AS spec
      CROSS JOIN (SELECT "Id" FROM "HealthFacilityStaff" WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1')) AS staff
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 10) PatientTransition — 70000002 (adulto, 19a, recorrido completo:
    // aviso a la posta, derivación, cita, primera atención y carta ya
    // enviada) — el "estado POST" de la transición, igual que ya lo es
    // para el traspaso de titularidad de consentimiento.
    await queryRunner.query(`
      INSERT INTO "PatientTransition"
        ("PatientId","State","MedicalRecordNumber","PrimaryDiagnosis","SpecialtyId","AttendingStaffId","District",
         "HealthPostFacilityId","HealthPostDistanceKm","ReferredToPostAt","HospitalReferral","Appointment",
         "AppointmentAddress","ArriveMinutesEarly","AdmissionNote",
         "CounterReferralStatus","CreatedById")
      SELECT
        pat."Id", 'FIRST_CARE_DONE', 'HC-118823', 'Cardiopatía congénita en seguimiento', spec."Id", staff."Id", 'San Juan de Lurigancho',
        post."Id", 3.5, CURRENT_TIMESTAMP - INTERVAL '14 months',
        -- OJO: "::jsonb" liga más fuerte que "||" — sin los paréntesis
        -- alrededor de TODA la concatenación, el cast se aplica solo al
        -- último literal ('"}') y no al string ya armado. Verificado
        -- contra un Postgres real (rompía con "invalid input syntax for
        -- type json" antes de este paréntesis).
        ('{"hospital":"Hospital Ficticio Adulto Sur","specialty":"Cardiología","doctor":"Internista Ficticio Uno","referredAt":"' || to_char(CURRENT_TIMESTAMP - INTERVAL '13 months', 'YYYY-MM-DD') || '"}')::jsonb,
        -- La hora (T09:30:00) es necesaria: el front calcula la hora de
        -- llegada y la cuenta de días restando sobre el time-of-day, no
        -- solo sobre la fecha (ver domain/rules/journey.rules.ts del front).
        ('{"hospital":"Hospital Ficticio Adulto Sur","specialist":"Internista Ficticio Uno","date":"' || to_char(CURRENT_TIMESTAMP - INTERVAL '11 months', 'YYYY-MM-DD') || 'T09:30:00","reason":"Control post-transición","managedBy":"Posta Ficticia San Juan de Lurigancho"}')::jsonb,
        'Hospital Ficticio Adulto Sur, Av. Ficticia 200, Lima (demo)', 30,
        'Llevar DNI y el carnet de citas — preséntate en Admisión, segundo piso.',
        'SENT', adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS pat
      CROSS JOIN (SELECT "Id" FROM "MedicalSpecialty" WHERE "Code" = 'CARDIO_PED') AS spec
      CROSS JOIN (SELECT "Id" FROM "HealthFacilityStaff" WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1')) AS staff
      CROSS JOIN (SELECT "Id" FROM "HealthFacility" WHERE "RenhiceCode" = 'DEMO-POST-004') AS post
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 11) Historial de avisos/reclamos de 70000002 — un reclamo por aviso
    // tardío y el aviso que lo resolvió, para mostrar el flujo completo.
    await queryRunner.query(`
      INSERT INTO "ReferralAlert" ("PatientId","Reason","SentAt","SentById","CreatedById")
      SELECT pat."Id", 'POST_NOTICE', CURRENT_TIMESTAMP - INTERVAL '14 months 3 days', ped."Id", adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1') AS ped
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "PostNotice" ("PatientId","SentAt","SentById","CreatedById")
      SELECT pat."Id", CURRENT_TIMESTAMP - INTERVAL '14 months', ref."Id", adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'referencias1') AS ref
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 12) La carta de contrarreferencia de 70000002, ya enviada.
    await queryRunner.query(`
      INSERT INTO "CounterReferral"
        ("PatientId","Status","FileName","Format","FileSize","StoragePath","Code",
         "UploadedById","UploadedAt","SentById","SentAt","CreatedById")
      SELECT
        pat."Id", 'SENT', 'carta-contrarreferencia-70000002.pdf', 'PDF', 245000,
        'counter-referrals/70000002/carta-contrarreferencia.pdf', 'CR-2026-00042',
        ref."Id", CURRENT_TIMESTAMP - INTERVAL '11 months', ref."Id", CURRENT_TIMESTAMP - INTERVAL '10 months', adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'referencias1') AS ref
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 13) Historia clínica de transferencia de 70000002, ya firmada.
    await queryRunner.query(`
      INSERT INTO "TransitionSummary"
        ("PatientId","Status","Sections","PendingChecks","DraftedByKind","DraftedByName","DraftedAt",
         "EditedById","EditedAt","ApprovedById","ApprovedAt","CreatedById")
      SELECT
        pat."Id", 'APPROVED',
        '[
          {"id":"identificacion","title":"Identificación","body":"Paciente Ficticio Adulto, DNI 70000002, HC-118823.","hint":""},
          {"id":"diagnostico","title":"Diagnóstico","body":"Cardiopatía congénita en seguimiento, estable.","hint":""},
          {"id":"tratamiento","title":"Tratamiento","body":"Control cardiológico semestral, sin medicación continua.","hint":""},
          {"id":"evolucion","title":"Evolución","body":"Seguimiento sin complicaciones desde el diagnóstico.","hint":""},
          {"id":"alertas","title":"Alertas","body":"Ninguna alergia conocida.","hint":""},
          {"id":"plan","title":"Plan","body":"Continuar control cardiológico en hospital de adultos.","hint":""}
        ]'::jsonb,
        '[]'::jsonb, 'AI', 'Generador IA (plantilla server-side)', CURRENT_TIMESTAMP - INTERVAL '11 months 20 days',
        ped."Id", CURRENT_TIMESTAMP - INTERVAL '11 months 15 days',
        ped."Id", CURRENT_TIMESTAMP - INTERVAL '11 months 10 days', adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1') AS ped
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 14) "Mi recorrido" de 70000001 (todavía menor, tutor1 activo y con
    // acceso) — contenido de cara al paciente/tutor, no historial técnico.
    await queryRunner.query(`
      INSERT INTO "JourneyChecklistItem" ("PatientId","Title","Detail","PendingLabel","Done","DisplayOrder","CreatedById")
      SELECT pat."Id", v."Title", v."Detail", v."PendingLabel", v."Done"::boolean, v."DisplayOrder"::int, adm."Id"
      FROM (VALUES
        ('70000001','Guardar mi historia clínica','Pedile a tu médico una copia cuando esté firmada.','Falta que se firme',false,1),
        ('70000001','Anotar mis medicamentos','Llevá la lista a cada consulta nueva.','Pendiente',false,2),
        ('70000001','Guardar el teléfono de la posta','Por si necesitás reprogramar la cita.','Pendiente',true,3)
      ) AS v("DocumentNumber","Title","Detail","PendingLabel","Done","DisplayOrder")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyMedication" ("PatientId","Initial","Name","Dose","Purpose","DisplayOrder","CreatedById")
      SELECT pat."Id", 'S', 'Salbutamol inhalador', '100mcg, según necesidad', 'Para cuando cuesta respirar', 1, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyAllergy" ("PatientId","Substance","Detail","DisplayOrder","CreatedById")
      SELECT pat."Id", 'Penicilina', 'Reacción moderada — evitar antibióticos de esa familia', 1, adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyContact" ("PatientId","Role","Name","Detail","DisplayOrder","CreatedById")
      SELECT pat."Id", v."Role", v."Name", v."Detail", v."DisplayOrder"::int, adm."Id"
      FROM (VALUES
        ('70000001','Especialista','Pediatra Ficticio Uno','01-500-0001',1),
        ('70000001','Posta asignada','Posta Ficticia San Juan de Lurigancho','01-500-0004',2)
      ) AS v("DocumentNumber","Role","Name","Detail","DisplayOrder")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "JourneyMessage" ("PatientId","Text","SentById","SentAt","CreatedById")
      SELECT pat."Id", 'Hola, no te olvides de llevar tu carnet a la próxima cita.', tutor."Id", CURRENT_TIMESTAMP - INTERVAL '2 days', adm."Id"
      FROM (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001') AS pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'tutor1') AS tutor
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // 15) Guía de preguntas frecuentes (global, no por paciente).
    await queryRunner.query(`
      INSERT INTO "JourneyGuideEntry" ("Question","Answer","DisplayOrder","CreatedById")
      SELECT v."Question", v."Answer", v."DisplayOrder"::int, adm."Id"
      FROM (VALUES
        ('¿Qué pasa si pierdo la cita?','Llamá a la posta asignada para reprogramarla lo antes posible.',1),
        ('¿Puedo seguir yendo al hospital de niños?','No después de cumplir 18 — tu atención pasa al hospital de adultos que te asignaron.',2)
      ) AS v("Question","Answer","DisplayOrder")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "JourneyGuideEntry"`);
    await queryRunner.query(`
      DELETE FROM "JourneyMessage" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001')
    `);
    await queryRunner.query(`
      DELETE FROM "JourneyContact" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001')
    `);
    await queryRunner.query(`
      DELETE FROM "JourneyAllergy" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001')
    `);
    await queryRunner.query(`
      DELETE FROM "JourneyMedication" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001')
    `);
    await queryRunner.query(`
      DELETE FROM "JourneyChecklistItem" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000001')
    `);
    await queryRunner.query(`
      DELETE FROM "TransitionSummary" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
    `);
    await queryRunner.query(`
      DELETE FROM "CounterReferral" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
    `);
    await queryRunner.query(`
      DELETE FROM "PostNotice" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
    `);
    await queryRunner.query(`
      DELETE FROM "ReferralAlert" WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000002')
    `);
    await queryRunner.query(`DELETE FROM "PatientTransition"`);
    await queryRunner.query(`
      DELETE FROM "HealthFacilityStaff" WHERE "UserId" = (SELECT "Id" FROM "User" WHERE "UserName" = 'referencias1')
    `);
    await queryRunner.query(
      `DELETE FROM "HealthFacility" WHERE "RenhiceCode" = 'DEMO-POST-004'`,
    );
    await queryRunner.query(`DELETE FROM "HealthFacilityStaffSpecialty"`);
    await queryRunner.query(`
      DELETE FROM "UserRole" WHERE "RoleId" IN (
        SELECT "Id" FROM "Role" WHERE "Code" IN ('ESPECIALISTA_PEDIATRIA','AREA_REFERENCIAS','PACIENTE_TITULAR','ACOMPANANTE')
      )
    `);
    await queryRunner.query(
      `DELETE FROM "User" WHERE "UserName" IN ('referencias1', 'inactivo1', 'sinpermisos')`,
    );
    // Grant a OPER sobre REPORT_READ, que YA existía antes de esta
    // migración — no entra en el DELETE genérico de abajo, que solo
    // apunta a los 10 permisos nuevos (PATIENT_COHORT_READ incluido).
    await queryRunner.query(`
      DELETE FROM "RolePermission" WHERE "RoleId" = (SELECT "Id" FROM "Role" WHERE "Code" = 'OPER')
        AND "PermissionId" IN (SELECT "Id" FROM "Permission" WHERE "Code" = 'REPORT_READ')
    `);
    await queryRunner.query(`
      DELETE FROM "RolePermission" WHERE "PermissionId" IN (
        SELECT "Id" FROM "Permission" WHERE "Code" IN (
          'PATIENT_COHORT_READ','REPORT_READ','REFERRAL_READ','REFERRAL_AREA_NOTIFY','HEALTH_POST_NOTIFY',
          'COUNTER_REFERRAL_MANAGE','JOURNEY_READ','CHECKLIST_WRITE','GUARDIAN_REMIND','GUARDIAN_ACCESS_MANAGE'
        )
      )
    `);
    await queryRunner.query(`
      DELETE FROM "Role" WHERE "Code" IN ('ESPECIALISTA_PEDIATRIA','AREA_REFERENCIAS','PACIENTE_TITULAR','ACOMPANANTE')
    `);
    await queryRunner.query(`
      DELETE FROM "Permission" WHERE "Code" IN (
        'PATIENT_COHORT_READ','REPORT_READ','REFERRAL_READ','REFERRAL_AREA_NOTIFY','HEALTH_POST_NOTIFY',
        'COUNTER_REFERRAL_MANAGE','JOURNEY_READ','CHECKLIST_WRITE','GUARDIAN_REMIND','GUARDIAN_ACCESS_MANAGE'
      )
    `);
    await queryRunner.query(`DELETE FROM "MedicalSpecialty"`);
    await queryRunner.query(
      `ALTER TABLE "HealthFacility" DROP CONSTRAINT "CK_HealthFacility_FacilityType"`,
    );
    await queryRunner.query(`
      ALTER TABLE "HealthFacility" ADD CONSTRAINT "CK_HealthFacility_FacilityType"
        CHECK ("FacilityType" IN ('PEDIATRICO','ADULTO','MIXTO'))
    `);
  }
}
