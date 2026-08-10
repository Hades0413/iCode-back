import { Column, Entity } from 'typeorm';
import { AuditableEntity } from './base/auditable.entity';

/**
 * "MenuId" es metadata (a qué pantalla pertenece, para agrupar en la UI de
 * administración) — no participa en la autorización. Ver
 * migrations/README.md.
 */
@Entity('Permission')
export class Permission extends AuditableEntity {
  @Column({ name: 'MenuId', type: 'int', nullable: true })
  menuId: number | null;

  @Column({ name: 'Code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'Name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'Description', type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ name: 'State', type: 'boolean' })
  state: boolean;
}
