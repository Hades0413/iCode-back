import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * No extiende AuditableEntity a propósito: acá "CreatedById" es nullable
 * (la única excepción de todo el esquema — ver
 * infrastructure/database/migrations/README.md, el usuario "system" que
 * no tiene autor previo). En el resto de las tablas es NOT NULL.
 *
 * PasswordHash/PasswordSalt son bytea (Buffer en Node), no un string
 * autocontenido como bcrypt/argon2 — ver
 * src/common/utils/password-hashing.util.ts (PBKDF2-HMAC-SHA256).
 */
@Entity('User')
export class User {
  @PrimaryGeneratedColumn({ name: 'Id' })
  id: number;

  @Column({ name: 'UserName', type: 'varchar', length: 100 })
  userName: string;

  @Column({ name: 'Email', type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ name: 'FirstName', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'LastName', type: 'varchar', length: 100 })
  lastName: string;

  @Column({ name: 'PasswordHash', type: 'bytea' })
  passwordHash: Buffer;

  @Column({ name: 'PasswordSalt', type: 'bytea' })
  passwordSalt: Buffer;

  @Column({
    name: 'LastLoginAt',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  lastLoginAt: Date | null;

  @Column({ name: 'FailedLoginAttempts', type: 'int' })
  failedLoginAttempts: number;

  @Column({
    name: 'LockoutEnd',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  lockoutEnd: Date | null;

  @Column({
    name: 'PasswordChangedAt',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  passwordChangedAt: Date | null;

  @Column({ name: 'TwoFactorEnabled', type: 'boolean' })
  twoFactorEnabled: boolean;

  @Column({
    name: 'TwoFactorSecret',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  twoFactorSecret: string | null;

  @Column({ name: 'SecurityStamp', type: 'uuid' })
  securityStamp: string;

  @Column({ name: 'State', type: 'boolean' })
  state: boolean;

  @Column({ name: 'Photo', type: 'varchar', length: 250, nullable: true })
  photo: string | null;

  @Column({ name: 'CreatedAt', type: 'timestamp', precision: 6 })
  createdAt: Date;

  @Column({ name: 'CreatedById', type: 'int', nullable: true })
  createdById: number | null;

  @Column({
    name: 'UpdatedAt',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  updatedAt: Date | null;

  @Column({ name: 'UpdatedById', type: 'int', nullable: true })
  updatedById: number | null;

  @DeleteDateColumn({ name: 'DeletedAt', type: 'timestamp', precision: 6 })
  deletedAt: Date | null;

  @Column({ name: 'DeletedById', type: 'int', nullable: true })
  deletedById: number | null;

  @Column({ name: 'RowVersion', type: 'bigint', update: false })
  rowVersion: string;
}
