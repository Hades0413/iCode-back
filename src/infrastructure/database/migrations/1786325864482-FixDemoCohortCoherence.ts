import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pone los datos de demo de acuerdo con las reglas que la propia app aplica,
 * para las dos pantallas del médico: "Mis pacientes" y "Ya cumplieron 18".
 *
 * El síntoma era que las tarjetas de arriba y la tabla de abajo parecían
 * contradecirse. No era un filtro roto: los filtros aplican las ventanas de
 * negocio y los datos estaban FUERA de ellas, así que había filas en estados
 * que la propia app considera imposibles.
 *
 * Las reglas (iguales en los dos lados: ENABLE_MONTHS_BEFORE_18 y
 * SIGN_MONTHS_BEFORE_18 en transition-summary.service.ts, y
 * ENABLED_MONTHS_BEFORE_18 / SIGN_MONTHS_BEFORE_18 en iCode-front):
 *
 *   - la historia de transferencia se puede CREAR desde 3 meses antes de los 18;
 *   - se FIRMA en el último mes;
 *   - quien ya cruzó y fue atendido tuvo una CITA y viajó con su historia firmada.
 *
 * El seed original se escribió para una ventana vieja de 9 meses (el mismo "9"
 * que quedó por un tiempo en el texto al pie de la pantalla) y nunca se ajustó
 * cuando la regla pasó a 3.
 *
 * No se toca ninguna fecha de nacimiento: mover cumpleaños cambiaría los avisos
 * a la posta, "Mi recorrido" y la edad que se muestra. Se corrige el estado del
 * resumen y de la cita, que es lo que estaba mal.
 */
export class FixDemoCohortCoherence1786325864482 implements MigrationInterface {
  name = 'FixDemoCohortCoherence1786325864482';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1) EN TUTELA — borradores creados fuera de la ventana de 3 meses.
    //
    // 70000010..70000014 están a 5, 6, 7, 8 y 9 meses y tenían el borrador
    // completo. La app los mostraba en escalón "Revisión" ("espera que un
    // médico lo firme") pero NINGUNA tarjeta los contaba, porque todas
    // aplican la ventana — y encima "Pacientes en tutela" los metía en
    // "aún no arranca". Sin borrador quedan en "Aún no arranca", que es lo
    // que de verdad les toca.
    // ============================================================
    await queryRunner.query(`
      DELETE FROM "TransitionSummary"
      WHERE "PatientId" IN (
        SELECT "Id" FROM "Patient"
        WHERE "DocumentNumber" IN ('70000010','70000011','70000012','70000013','70000014')
      )
    `);

    // Y su estado: "Preparando" sin nada que preparar y fuera de la ventana
    // no dice nada. Vuelven a "Sin empezar".
    await queryRunner.query(`
      UPDATE "PatientTransition" SET
        "State" = 'PENDING',
        "UpdatedAt" = CURRENT_TIMESTAMP,
        "UpdatedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'admin')
      WHERE "State" = 'IN_PREPARATION'
        AND "PatientId" IN (
          SELECT "Id" FROM "Patient"
          WHERE "DocumentNumber" IN ('70000012','70000013','70000014')
        )
    `);

    // ============================================================
    // 2) EN TUTELA — firmas fuera de la ventana de firma (último mes).
    //
    // 70000015 está a 4 meses: fuera hasta de la ventana de creación, así
    // que no puede tener ni borrador. Queda sin resumen; sigue "En la posta",
    // que es correcto — al caso lo derivan antes de que la historia se firme.
    //
    // 70000018 está a 2 meses: puede tener BORRADOR pero no firma. Baja a
    // borrador y conserva su cita, que también es correcto: la posta consigue
    // la fecha mientras la historia todavía se está escribiendo.
    // ============================================================
    await queryRunner.query(`
      DELETE FROM "TransitionSummary"
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000015')
    `);
    await queryRunner.query(`
      UPDATE "TransitionSummary" SET
        "Status" = 'DRAFT',
        "ApprovedById" = NULL,
        "ApprovedAt" = NULL,
        "UpdatedAt" = CURRENT_TIMESTAMP,
        "UpdatedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'admin')
      WHERE "PatientId" = (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" = '70000018')
    `);

    // ============================================================
    // 3) EN TUTELA — "Ya tiene cita" sin cita.
    //
    // 70000019 estaba en APPOINTMENT_GRANTED con "Appointment" en NULL: la
    // fila decía "Ya tiene cita" y la ficha no tenía ninguna que mostrar.
    // La cita va después del cumpleaños, que es cuando el hospital de
    // adultos puede atenderlo.
    // ============================================================
    await queryRunner.query(`
      UPDATE "PatientTransition" pt SET
        "Appointment" = (
          '{"hospital":"Hospital Ficticio Adulto Sur",'
          || '"specialist":"Internista Ficticio Uno",'
          || '"date":"' || to_char(pat."DateOfBirth" + INTERVAL '18 years' + INTERVAL '14 days', 'YYYY-MM-DD') || 'T10:30:00",'
          || '"reason":"Primera cita en adultos",'
          || '"managedBy":"Posta Ficticia San Juan de Lurigancho"}'
        )::jsonb,
        "AppointmentAddress" = 'Hospital Ficticio Adulto Sur, Av. Ficticia 200, Lima (demo)',
        "ArriveMinutesEarly" = 30,
        "UpdatedAt" = CURRENT_TIMESTAMP,
        "UpdatedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'admin')
      FROM "Patient" pat
      WHERE pat."Id" = pt."PatientId"
        AND pat."DocumentNumber" = '70000019'
        AND pt."Appointment" IS NULL
    `);

    // ============================================================
    // 4) YA CUMPLIERON 18 — la cita que la fila dice tener.
    //
    // La tabla de seguimiento pregunta tres cosas: ¿tiene cita?, ¿cuándo?,
    // ¿acudió? Y las tres salen de "Appointment": sin ella la fila muestra
    // "No" y dos rayas, aunque el estado del caso diga FIRST_CARE_DONE.
    // Por eso las tarjetas decían "llegaron a su primera cita" mientras la
    // tabla mostraba "Tiene cita: No".
    //
    // Se le pone cita a todo el que efectivamente cruzó: atendido, reingreso
    // y también el que se perdió — ESE la tuvo y no fue, que es justamente lo
    // que hace que su fila se lea "Acudió: No" en rojo.
    //
    // Queda a propósito SIN cita 70000003: cumplió 18 hace 2 años y sigue en
    // APPOINTMENT_IN_PROCESS, sin historia. Es el caso en que todo salió mal
    // y la pantalla tiene que poder mostrarlo.
    // ============================================================
    await queryRunner.query(`
      UPDATE "PatientTransition" pt SET
        "Appointment" = (
          '{"hospital":"Hospital Ficticio Adulto Sur",'
          || '"specialist":"Internista Ficticio Uno",'
          || '"date":"' || to_char(pat."DateOfBirth" + INTERVAL '18 years' + INTERVAL '21 days', 'YYYY-MM-DD') || 'T09:00:00",'
          || '"reason":"Primera cita en adultos",'
          || '"managedBy":"Posta Ficticia San Juan de Lurigancho"}'
        )::jsonb,
        "AppointmentAddress" = 'Hospital Ficticio Adulto Sur, Av. Ficticia 200, Lima (demo)',
        "ArriveMinutesEarly" = 30,
        "UpdatedAt" = CURRENT_TIMESTAMP,
        "UpdatedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'admin')
      FROM "Patient" pat
      WHERE pat."Id" = pt."PatientId"
        AND pt."Appointment" IS NULL
        AND pt."State" IN ('FIRST_CARE_DONE','LOST_TO_FOLLOW_UP','READMITTED')
        AND pat."DocumentNumber" LIKE '7000%'
    `);

    // ============================================================
    // 5) YA CUMPLIERON 18 — la historia firmada con la que cruzaron.
    //
    // 11 de 12 habían pasado al hospital de adultos con "summaryStatus:
    // NONE", que es exactamente lo que el producto existe para evitar: sin
    // historia firmada el otro lado arranca a ciegas y el "pase de consulta"
    // no tiene nada que mostrar.
    //
    // Se firma 1 día antes del cumpleaños, así que las fechas del documento
    // se derivan de la fecha de nacimiento de cada uno y no de hoy.
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "TransitionSummary"
        ("PatientId","Status","Sections","PendingChecks","DraftedByKind","DraftedByName",
         "DraftedAt","ApprovedById","ApprovedAt","CreatedById")
      SELECT
        pat."Id",
        'APPROVED',
        json_build_array(
          json_build_object(
            'id','identificacion','title','Identificación','hint','',
            'body', 'Paciente ' || pat."FirstName" || ' ' || pat."LastName"
                    || ', DNI ' || pat."DocumentNumber"
                    || '. Historia clínica ' || pt."MedicalRecordNumber" || '.'
          ),
          json_build_object(
            'id','diagnostico','title','Diagnóstico','hint','',
            'body', COALESCE(pt."PrimaryDiagnosis", 'Sin diagnóstico principal registrado.')
                    || ' Seguimiento en el INSN San Borja hasta el traspaso.'
          ),
          json_build_object(
            'id','plan','title','Plan','hint','',
            'body','Continuar el control en el hospital de adultos asignado por la posta. Se adjunta el esquema de tratamiento vigente al momento del traspaso.'
          )
        )::jsonb,
        '[]'::jsonb,
        'AI',
        'Generador IA (plantilla server-side)',
        pat."DateOfBirth" + INTERVAL '18 years' - INTERVAL '10 days',
        ped."Id",
        pat."DateOfBirth" + INTERVAL '18 years' - INTERVAL '1 day',
        adm."Id"
      FROM "Patient" pat
      JOIN "PatientTransition" pt ON pt."PatientId" = pat."Id"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1') AS ped
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
      WHERE pat."DocumentNumber" LIKE '7000%'
        AND pt."State" IN ('FIRST_CARE_DONE','LOST_TO_FOLLOW_UP','READMITTED')
        AND NOT EXISTS (
          SELECT 1 FROM "TransitionSummary" ts WHERE ts."PatientId" = pat."Id"
        )
    `);
  }

  /**
   * La vuelta atrás devuelve los datos al estado incoherente anterior, que es
   * lo que significa revertir esta migración. Los borradores que se borraron
   * se vuelven a crear con el mismo contenido mínimo que ponía el seed —
   * son datos de prueba, no hay nada de un usuario que perder.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // 5) y 4) — quitar la historia y la cita de los que ya cruzaron.
    await queryRunner.query(`
      DELETE FROM "TransitionSummary"
      WHERE "PatientId" IN (
        SELECT pat."Id" FROM "Patient" pat
        JOIN "PatientTransition" pt ON pt."PatientId" = pat."Id"
        WHERE pat."DocumentNumber" IN
          ('70000020','70000021','70000022','70000023','70000024',
           '70000025','70000026','70000027','70000028','70000029')
      )
    `);
    await queryRunner.query(`
      UPDATE "PatientTransition" pt SET
        "Appointment" = NULL, "AppointmentAddress" = NULL, "ArriveMinutesEarly" = NULL
      FROM "Patient" pat
      WHERE pat."Id" = pt."PatientId"
        AND pat."DocumentNumber" IN
          ('70000019','70000020','70000021','70000022','70000023',
           '70000025','70000026','70000027','70000028','70000029')
    `);

    // 2) — devolver la firma fuera de ventana.
    await queryRunner.query(`
      UPDATE "TransitionSummary" ts SET
        "Status" = 'APPROVED',
        "ApprovedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1'),
        "ApprovedAt" = CURRENT_TIMESTAMP - INTERVAL '1 day'
      FROM "Patient" pat
      WHERE pat."Id" = ts."PatientId" AND pat."DocumentNumber" = '70000018'
    `);

    // 1) y 2) — recrear los resúmenes borrados (70000010..70000015).
    await queryRunner.query(`
      INSERT INTO "TransitionSummary"
        ("PatientId","Status","Sections","PendingChecks","DraftedByKind","DraftedByName",
         "DraftedAt","ApprovedById","ApprovedAt","CreatedById")
      SELECT
        pat."Id",
        CASE WHEN pat."DocumentNumber" = '70000015' THEN 'APPROVED' ELSE 'DRAFT' END,
        json_build_array(
          json_build_object('id','identificacion','title','Identificación','hint','',
            'body','DNI ' || pat."DocumentNumber" || '.'),
          json_build_object('id','diagnostico','title','Diagnóstico','hint','',
            'body','Ver ficha del paciente.'),
          json_build_object('id','plan','title','Plan','hint','',
            'body','Continuar el seguimiento en el hospital de adultos que le asigne la posta.')
        )::jsonb,
        '[]'::jsonb, 'AI', 'Generador IA (plantilla server-side)',
        CURRENT_TIMESTAMP - INTERVAL '2 days',
        CASE WHEN pat."DocumentNumber" = '70000015'
          THEN (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1') END,
        CASE WHEN pat."DocumentNumber" = '70000015'
          THEN CURRENT_TIMESTAMP - INTERVAL '1 day' END,
        adm."Id"
      FROM "Patient" pat
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
      WHERE pat."DocumentNumber" IN
        ('70000010','70000011','70000012','70000013','70000014','70000015')
    `);
    await queryRunner.query(`
      UPDATE "PatientTransition" SET "State" = 'IN_PREPARATION'
      WHERE "PatientId" IN (
        SELECT "Id" FROM "Patient"
        WHERE "DocumentNumber" IN ('70000012','70000013','70000014')
      )
    `);
  }
}
