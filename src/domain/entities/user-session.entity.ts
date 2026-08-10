import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Sesión de login como fila en la base, no un JWT: la columna "Token"
 * guarda el HASH (sha256) del token real, nunca el token en texto plano
 * — igual que una contraseña, si alguien lee la base no debería poder
 * usar lo que hay ahí para autenticarse. El token real solo existe una
 * vez, en la respuesta de POST /auth/login.
 *
 * "RevokedAt" es justo lo que resuelve lo que no puede resolver un JWT
 * stateless: cerrar sesión de verdad. Login la crea, logout le pone
 * fecha acá, y el guard rechaza cualquier sesión con "RevokedAt" NOT
 * NULL — no hay que esperar a que expire sola.
 */
@Entity('UserSession')
export class UserSession {
  @PrimaryGeneratedColumn('uuid', { name: 'Id' })
  id: string;

  @Column({ name: 'UserId', type: 'int' })
  userId: number;

  @Column({ name: 'Token', type: 'varchar', length: 500 })
  tokenHash: string;

  @Column({ name: 'CreatedAt', type: 'timestamp', precision: 6 })
  createdAt: Date;

  @Column({ name: 'ExpiresAt', type: 'timestamp', precision: 6 })
  expiresAt: Date;

  @Column({ name: 'LastActivityAt', type: 'timestamp', precision: 6 })
  lastActivityAt: Date;

  @Column({
    name: 'RevokedAt',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  revokedAt: Date | null;

  @Column({ name: 'IpAddress', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'UserAgent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @DeleteDateColumn({ name: 'DeletedAt', type: 'timestamp', precision: 6 })
  deletedAt: Date | null;

  @Column({ name: 'DeletedById', type: 'int', nullable: true })
  deletedById: number | null;

  @Column({ name: 'RowVersion', type: 'bigint', update: false })
  rowVersion: string;
}
