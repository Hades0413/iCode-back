import { Column, DeleteDateColumn, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Las columnas de auditoría que se repiten en (casi) toda tabla del
 * esquema (ver migrations/README.md). "RowVersion" se lee acá pero
 * `update: false`: quien lo incrementa es el trigger de Postgres
 * (set_row_version, ver CreateInitialSchema) en cada UPDATE — si además
 * usáramos @VersionColumn() de TypeORM, los dos lo incrementarían y
 * cualquier .save() fallaría con un falso conflicto de concurrencia.
 *
 * "User" NO extiende de esto: ahí "CreatedById" es nullable (la única
 * excepción del esquema — ver migrations/README.md, el bootstrap de
 * "system"), acá es NOT NULL como en el resto de las tablas.
 */
export abstract class AuditableEntity {
  @PrimaryGeneratedColumn({ name: 'Id' })
  id: number;

  @Column({ name: 'CreatedAt', type: 'timestamp', precision: 6 })
  createdAt: Date;

  @Column({ name: 'CreatedById', type: 'int' })
  createdById: number;

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
