import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tercera tanda de volumen. Esta vez no son pacientes nuevos: son tablas
 * que ya existían sin ninguna fila de seed (o con un hueco de integridad
 * real), detectadas al revisar qué le falta al dominio para poder probar
 * sus pantallas de punta a punta:
 *
 * - "ReferralReview" y "PatientAttachment" (de AddReferralReviewAndAttachments,
 *   1786325861482) tenían el DDL pero CERO filas en cualquier seed.
 * - Los 20 pacientes de SeedMoreDemoPatients (1786325864482) quedaron sin
 *   tutor legal — un hueco real, no una elección: los 10 menores de esa
 *   tanda no tienen forma de que un tutor gestione su tutela todavía.
 */
export class SeedReferralReviewAttachmentsAndGuardians1786325865482 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1) ReferralReview — 20 filas, una por cada paciente YA adulto
    // (70000020-70000029 de SeedBulkDemoData + 70000058-70000067 de
    // SeedMoreDemoPatients): es la respuesta del hospital de destino a
    // la historia de transferencia, así que solo aplica post-transición.
    // 10 ACCEPTED, 5 REJECTED, 5 OBSERVED (estas últimas con el PDF de
    // detalle — mismo patrón de disco local que CounterReferral).
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "ReferralReview"
        ("PatientId","Status","Notes","FileName","FileSize","StoragePath","ReviewedById","ReviewedAt","CreatedById")
      SELECT
        pat."Id", v."Status", v."Notes",
        CASE WHEN v."Status" = 'OBSERVED' THEN 'observacion-' || v."DocumentNumber" || '.pdf' ELSE NULL END,
        CASE WHEN v."Status" = 'OBSERVED' THEN 180000 ELSE NULL END,
        CASE WHEN v."Status" = 'OBSERVED' THEN 'referral-reviews/' || v."DocumentNumber" || '/observacion.pdf' ELSE NULL END,
        ref."Id", CURRENT_TIMESTAMP - (v."DaysAgo" || ' days')::interval, adm."Id"
      FROM (VALUES
        ('70000020','ACCEPTED','Historia clínica completa, sin observaciones.','5'),
        ('70000021','ACCEPTED','Recibido conforme.','8'),
        ('70000022','ACCEPTED','Continuidad de tratamiento sin cambios.','12'),
        ('70000023','ACCEPTED','Aceptado sin observaciones.','15'),
        ('70000024','ACCEPTED','Documentación completa.','20'),
        ('70000058','ACCEPTED','Recibido conforme.','3'),
        ('70000059','ACCEPTED','Historia clínica completa.','6'),
        ('70000060','ACCEPTED','Sin observaciones.','9'),
        ('70000061','ACCEPTED','Aceptado, continuidad asegurada.','11'),
        ('70000062','ACCEPTED','Documentación conforme.','14'),
        ('70000025','REJECTED','Falta el resultado del último control de laboratorio.','7'),
        ('70000026','REJECTED','No incluye el esquema de vacunación actualizado.','10'),
        ('70000063','REJECTED','Falta la epicrisis del último ingreso.','4'),
        ('70000064','REJECTED','Diagnóstico principal sin CIE-10 asociado.','13'),
        ('70000065','REJECTED','Falta firma del médico tratante en el resumen.','16'),
        ('70000027','OBSERVED','Se solicita precisar el esquema de medicación vigente.','2'),
        ('70000028','OBSERVED','Falta detalle de la última hospitalización.','17'),
        ('70000029','OBSERVED','Se pide adjuntar los exámenes de imagen recientes.','19'),
        ('70000066','OBSERVED','Aclarar la vía de administración de la medicación.','1'),
        ('70000067','OBSERVED','Falta el contacto del cuidador principal.','18')
      ) AS v("DocumentNumber","Status","Notes","DaysAgo")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'referencias1') AS ref
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 2) PatientAttachment — 20 filas repartidas entre 12 pacientes
    // (1:N a propósito, a diferencia de ReferralReview): mezcla de
    // imagen/PDF/Word/video, distintos tamaños.
    // ============================================================
    await queryRunner.query(`
      INSERT INTO "PatientAttachment"
        ("PatientId","FileName","FileSize","StoragePath","UploadedById","UploadedAt","CreatedById")
      SELECT
        pat."Id", v."FileName", v."FileSize"::int,
        'patient-attachments/' || v."DocumentNumber" || '/' || v."FileName",
        ped."Id", CURRENT_TIMESTAMP - (v."DaysAgo" || ' days')::interval, adm."Id"
      FROM (VALUES
        ('70000010','radiografia-torax.jpg','820000','5'),
        ('70000010','informe-laboratorio.pdf','210000','4'),
        ('70000011','ecocardiograma.pdf','340000','8'),
        ('70000012','electroencefalograma.pdf','450000','12'),
        ('70000013','perfil-glucemico.pdf','180000','6'),
        ('70000013','informe-nutricional.docx','95000','3'),
        ('70000014','ecografia-renal.jpg','760000','9'),
        ('70000015','espirometria.pdf','220000','7'),
        ('70000016','frotis-sangre.jpg','690000','11'),
        ('70000016','informe-hematologia.docx','110000','10'),
        ('70000017','resonancia-articular.jpg','1450000','14'),
        ('70000018','informe-oncologico.pdf','390000','2'),
        ('70000018','evaluacion-fisica.mp4','5200000','1'),
        ('70000019','ecocardiograma-control.pdf','360000','13'),
        ('70000020','informe-transferencia.pdf','410000','20'),
        ('70000048','radiografia-abdomen.jpg','880000','15'),
        ('70000050','perfil-glucemico-control.pdf','175000','16'),
        ('70000053','informe-reumatologia.docx','120000','17'),
        ('70000058','epicrisis-hospitalizacion.pdf','520000','18'),
        ('70000060','tomografia-torax.jpg','1620000','19')
      ) AS v("DocumentNumber","FileName","FileSize","DaysAgo")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'pediatra1') AS ped
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);

    // ============================================================
    // 3) Tutores para los 10 menores de SeedMoreDemoPatients
    // (70000048-70000057) — mismo patrón que SeedBulkDemoData
    // (tutor3..tutor12), continuando con tutor13..tutor22.
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
        ('tutor13','Beatriz','Ficticio Trece'),
        ('tutor14','Ricardo','Ficticio Catorce'),
        ('tutor15','Silvia','Ficticio Quince'),
        ('tutor16','Óscar','Ficticio Dieciséis'),
        ('tutor17','Teresa','Ficticio Diecisiete'),
        ('tutor18','Hugo','Ficticio Dieciocho'),
        ('tutor19','Milagros','Ficticio Diecinueve'),
        ('tutor20','Ernesto','Ficticio Veinte'),
        ('tutor21','Rocío','Ficticio Veintiuno'),
        ('tutor22','Álvaro','Ficticio Veintidós')
      ) AS v("UserName","FirstName","LastName")
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "UserRole" ("UserId","RoleId","CreatedById")
      SELECT u."Id", r."Id", adm."Id"
      FROM (SELECT "Id" FROM "User" WHERE "UserName" IN (
        'tutor13','tutor14','tutor15','tutor16','tutor17','tutor18','tutor19','tutor20','tutor21','tutor22'
      )) AS u
      CROSS JOIN (SELECT "Id" FROM "Role" WHERE "Code" = 'ACOMPANANTE') AS r
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
    await queryRunner.query(`
      INSERT INTO "LegalGuardian" ("PatientId","UserId","RelationshipType","IsPrimary","IsActive","HasJourneyAccess","CreatedById")
      SELECT pat."Id", tut."Id", v."RelationshipType", true, true, true, adm."Id"
      FROM (VALUES
        ('70000048','tutor13','MADRE'),
        ('70000049','tutor14','PADRE'),
        ('70000050','tutor15','TUTOR_LEGAL'),
        ('70000051','tutor16','OTRO'),
        ('70000052','tutor17','MADRE'),
        ('70000053','tutor18','PADRE'),
        ('70000054','tutor19','TUTOR_LEGAL'),
        ('70000055','tutor20','OTRO'),
        ('70000056','tutor21','MADRE'),
        ('70000057','tutor22','PADRE')
      ) AS v("DocumentNumber","TutorUserName","RelationshipType")
      JOIN "Patient" pat ON pat."DocumentNumber" = v."DocumentNumber"
      JOIN "User" tut ON tut."UserName" = v."TutorUserName"
      CROSS JOIN (SELECT "Id" FROM "User" WHERE "UserName" = 'admin') AS adm
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const guardianUsers = Array.from(
      { length: 10 },
      (_, i) => `'tutor${i + 13}'`,
    ).join(',');
    const minorDocs = Array.from(
      { length: 10 },
      (_, i) => `'700000${48 + i}'`,
    ).join(',');
    const reviewDocs = [
      '70000020',
      '70000021',
      '70000022',
      '70000023',
      '70000024',
      '70000025',
      '70000026',
      '70000027',
      '70000028',
      '70000029',
      '70000058',
      '70000059',
      '70000060',
      '70000061',
      '70000062',
      '70000063',
      '70000064',
      '70000065',
      '70000066',
      '70000067',
    ]
      .map((d) => `'${d}'`)
      .join(',');
    const attachmentDocs = [
      '70000010',
      '70000011',
      '70000012',
      '70000013',
      '70000014',
      '70000015',
      '70000016',
      '70000017',
      '70000018',
      '70000019',
      '70000020',
      '70000048',
      '70000050',
      '70000053',
      '70000058',
      '70000060',
    ]
      .map((d) => `'${d}'`)
      .join(',');

    await queryRunner.query(`
      DELETE FROM "LegalGuardian" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${minorDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "UserRole" WHERE "UserId" IN (SELECT "Id" FROM "User" WHERE "UserName" IN (${guardianUsers}))
    `);
    await queryRunner.query(
      `DELETE FROM "User" WHERE "UserName" IN (${guardianUsers})`,
    );
    await queryRunner.query(`
      DELETE FROM "PatientAttachment" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${attachmentDocs}))
    `);
    await queryRunner.query(`
      DELETE FROM "ReferralReview" WHERE "PatientId" IN (SELECT "Id" FROM "Patient" WHERE "DocumentNumber" IN (${reviewDocs}))
    `);
  }
}
