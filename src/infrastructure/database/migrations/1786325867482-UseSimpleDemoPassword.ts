import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La contraseña de los usuarios de demo pasa de `Passw0rd1!` a `12345`.
 *
 * Es una decisión de demostración, no de seguridad: la contraseña se escribe
 * a mano delante de gente en cada presentación, y una que se dicta en dos
 * segundos ("uno, dos, tres, cuatro, cinco") ahorra el minuto de "¿la eñe?
 * ¿el signo va al final?" que se llevaba `Passw0rd1!`. Todos los datos de
 * este seed son ficticios y la base es local — no hay nada que proteger acá.
 *
 * **Nunca en un ambiente real.** El día que este proyecto tenga usuarios de
 * verdad, se crean con `hashPassword()` desde la aplicación y esta migración
 * no los toca: solo alcanza a las filas que todavía tienen el hash exacto del
 * seed, así que un usuario con contraseña propia queda intacto (y `system`,
 * que tiene un hash de relleno que nunca autentica, también).
 *
 * El hash se calculó con los mismos parámetros que
 * `common/utils/password-hashing.util.ts` — PBKDF2-HMAC-SHA256, 600.000
 * iteraciones, clave de 32 bytes — sobre el salt que ya traía el seed, que no
 * cambia. El `SecurityStamp` sí se renueva: es lo que corresponde cuando la
 * credencial cambia, aunque hoy ningún guard lo lea todavía.
 */
export class UseSimpleDemoPassword1786325867482 implements MigrationInterface {
  name = 'UseSimpleDemoPassword1786325867482';

  /** PBKDF2-HMAC-SHA256(600k, 32B) de "Passw0rd1!" con el salt del seed. */
  private static readonly OLD_HASH =
    'b90efe621fc76a08a09f6e7a9c5c8db958cad73c444208ec5cdb9e99d5aabb90';

  /** Lo mismo para "12345" — mismo salt, así solo cambia esta columna. */
  private static readonly NEW_HASH =
    'cbe9e8b30a9ea5fd399ad68c2041d21005548ad14ce4a4eddfb802c68c0b1689';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.swap(
      queryRunner,
      UseSimpleDemoPassword1786325867482.OLD_HASH,
      UseSimpleDemoPassword1786325867482.NEW_HASH,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.swap(
      queryRunner,
      UseSimpleDemoPassword1786325867482.NEW_HASH,
      UseSimpleDemoPassword1786325867482.OLD_HASH,
    );
  }

  private async swap(
    queryRunner: QueryRunner,
    fromHash: string,
    toHash: string,
  ): Promise<void> {
    await queryRunner.query(
      `
      UPDATE "User"
      SET "PasswordHash" = decode($1, 'hex'),
          "SecurityStamp" = gen_random_uuid(),
          "UpdatedAt" = CURRENT_TIMESTAMP,
          "UpdatedById" = (SELECT "Id" FROM "User" WHERE "UserName" = 'admin')
      WHERE "PasswordHash" = decode($2, 'hex')
      `,
      [toHash, fromHash],
    );
  }
}
