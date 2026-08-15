import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pone los datos de demo de acuerdo con lo que muestra "Por avisar a la posta".
 *
 * La bandeja tenía el mismo desajuste que las otras dos pantallas, y aquí era
 * el más grave: la tarjeta "Falta avisar" contaba 15 de 15, pero **12 de esas
 * 15 filas no tenían posta asignada** — la columna decía "Sin posta asignada"
 * y la celda de acción salía vacía, porque `canNotifyHealthPost` exige una
 * posta. O sea: la pantalla pedía hacer un trabajo que en 4 de cada 5 filas no
 * se podía hacer.
 *
 * La posta sale del domicilio del paciente, así que no es algo que "aparezca"
 * al entrar en la ventana de aviso: o se sabe desde el principio o no se sabe
 * nunca. Por eso se le asigna a toda la cohorte de demo y no solo a la que hoy
 * está en ventana.
 *
 * De paso, la única posta del seed era la de San Juan de Lurigancho y le tocaba
 * a pacientes de Comas, Ate o Puente Piedra. Una columna que se llama "Posta
 * que le toca" tiene que decir la del barrio del paciente, así que se siembra
 * una por distrito y cada uno queda con la suya.
 */
export class FixReferralQueueCoherence1786325865482 implements MigrationInterface {
  name = 'FixReferralQueueCoherence1786325865482';

  /** Los distritos de la cohorte de demo que todavía no tenían posta propia. */
  private static readonly POSTS = [
    ['DEMO-POST-005', 'Comas'],
    ['DEMO-POST-006', 'Los Olivos'],
    ['DEMO-POST-007', 'Villa El Salvador'],
    ['DEMO-POST-008', 'Ate'],
    ['DEMO-POST-009', 'San Juan de Miraflores'],
    ['DEMO-POST-010', 'Independencia'],
    ['DEMO-POST-011', 'Carabayllo'],
    ['DEMO-POST-012', 'Puente Piedra'],
    ['DEMO-POST-013', 'Villa María del Triunfo'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1) Una posta por distrito. La de San Juan de Lurigancho
    // (DEMO-POST-004) ya existe desde SeedTransitionData.
    // ============================================================
    const values = FixReferralQueueCoherence1786325865482.POSTS.map(
      ([code, district]) =>
        `('Posta Ficticia ${district.replaceAll("'", "''")}','${code}','POSTA','Av. Ficticia 400, ${district.replaceAll("'", "''")} (demo)','${district.replaceAll("'", "''")}')`,
    ).join(',');
    await queryRunner.query(`
      INSERT INTO "HealthFacility" ("Name","RenhiceCode","FacilityType","Address","District","CreatedById")
      SELECT v."Name", v."RenhiceCode", v."FacilityType", v."Address", v."District", adm."Id"
      FROM (VALUES ${values}) AS v("Name","RenhiceCode","FacilityType","Address","District")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 2) A cada paciente, la posta de SU distrito.
    //
    // La distancia se respeta si ya la tenía; para el resto sale del propio
    // documento, para que las filas no digan todas lo mismo (2.0 a 6.4 km,
    // que es el rango que ya usaba el seed).
    // ============================================================
    await queryRunner.query(`
      UPDATE "PatientTransition" pt SET
        "HealthPostFacilityId" = post."Id",
        "HealthPostDistanceKm" = COALESCE(
          pt."HealthPostDistanceKm",
          ROUND((2.0 + (RIGHT(pat."DocumentNumber", 2)::int % 45) / 10.0)::numeric, 1)
        ),
        "UpdatedAt" = CURRENT_TIMESTAMP,
        "UpdatedById" = adm."Id"
      FROM "Patient" pat, "HealthFacility" post,
           (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
      WHERE pat."Id" = pt."PatientId"
        AND pat."DocumentNumber" LIKE '7000%'
        AND post."FacilityType" = 'POSTA'
        AND post."District" = pt."District"
    `);

    // La cita ya emitida dice qué posta la gestionó: que siga siendo la misma
    // que ahora le toca al paciente, y no la de otro barrio.
    await queryRunner.query(`
      UPDATE "PatientTransition" pt SET
        "Appointment" = jsonb_set(pt."Appointment", '{managedBy}', to_jsonb(post."Name"))
      FROM "HealthFacility" post
      WHERE post."Id" = pt."HealthPostFacilityId"
        AND pt."Appointment" IS NOT NULL
    `);

    // ============================================================
    // 3) Avisos ya enviados.
    //
    // Sin ninguno, "Ya avisadas" era 0 de 15 por construcción, el escalón
    // "Posta avisada" no existía en la tabla y las filas solo podían pintarse
    // de ámbar o rojo — el estado normal de una fila resuelta no se veía nunca.
    //
    // Se avisa a los que están a 2 meses (que es cuando toca) y a dos de los
    // que hoy están a 1 mes, avisados a tiempo el mes pasado. Los otros cinco
    // quedan sin aviso a propósito: son los "Vencidos".
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "PostNotice" ("PatientId","SentAt","SentById","CreatedById")
      SELECT pat."Id", CURRENT_TIMESTAMP - (v."DaysAgo" || ' days')::interval, ref."Id", adm."Id"
      FROM (VALUES
        -- A 2 meses: el área avisó esta semana, en plazo.
        ('70000017','3'),('70000031','5'),('70000034','8'),
        ('70000040','11'),('70000046','6'),
        -- A 1 mes: avisados el mes pasado, cuando entraron en la ventana.
        ('70000019','34'),('70000041','29')
      ) AS v("DocumentNumber","DaysAgo")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'referencias1') AS ref
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 4) Reclamos del especialista.
    //
    // "Reclamados por el médico" también era 0 de 15 por construcción, y el
    // badge de reclamo de la fila no se podía ver. Dos de los vencidos —los
    // que peor están— ya tienen el reclamo del pediatra encima.
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "ReferralAlert" ("PatientId","Reason","SentAt","SentById","CreatedById")
      SELECT pat."Id", 'POST_NOTICE', CURRENT_TIMESTAMP - (v."DaysAgo" || ' days')::interval, ped."Id", adm."Id"
      FROM (VALUES ('70000035','4'), ('70000044','2')) AS v("DocumentNumber","DaysAgo")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1') AS ped
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "ReferralAlert"
      WHERE "PatientId" IN (
        SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN ('70000035','70000044')
      )
    `);
    await queryRunner.query(`
      DELETE FROM "PostNotice"
      WHERE "PatientId" IN (
        SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN
          ('70000017','70000019','70000031','70000034','70000040','70000041','70000046')
      )
    `);

    // Los que no tenían posta vuelven a no tenerla…
    await queryRunner.query(`
      UPDATE "PatientTransition" pt SET
        "HealthPostFacilityId" = NULL, "HealthPostDistanceKm" = NULL
      FROM "Patient" pat
      WHERE pat."Id" = pt."PatientId"
        AND pat."DocumentNumber" IN
          ('70000001','70000010','70000011','70000012','70000013','70000014',
           '70000030','70000031','70000032','70000033','70000034','70000035',
           '70000036','70000037','70000038','70000039','70000040','70000041',
           '70000042','70000043','70000044','70000045','70000046','70000047')
    `);
    // …y los que la tenían vuelven a la única que había.
    await queryRunner.query(`
      UPDATE "PatientTransition" pt SET "HealthPostFacilityId" = post."Id"
      FROM "Patient" pat,
           (SELECT "Id","Name" FROM "HealthFacility" WHERE "RenhiceCode" = 'DEMO-POST-004') AS post
      WHERE pat."Id" = pt."PatientId"
        AND pat."DocumentNumber" IN
          ('70000002','70000003','70000015','70000016','70000017','70000018','70000019',
           '70000020','70000021','70000022','70000023','70000024',
           '70000025','70000026','70000027','70000028','70000029')
    `);
    await queryRunner.query(`
      UPDATE "PatientTransition" pt SET
        "Appointment" = jsonb_set(pt."Appointment", '{managedBy}', to_jsonb(post."Name"))
      FROM "HealthFacility" post
      WHERE post."Id" = pt."HealthPostFacilityId"
        AND pt."Appointment" IS NOT NULL
    `);

    const codes = FixReferralQueueCoherence1786325865482.POSTS.map(
      ([code]) => `'${code}'`,
    ).join(',');
    await queryRunner.query(
      `DELETE FROM "HealthFacility" WHERE "RenhiceCode" IN (${codes})`,
    );
  }
}
