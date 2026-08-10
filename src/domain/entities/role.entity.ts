import { Column, Entity } from 'typeorm';
import { AuditableEntity } from './base/auditable.entity';

/**
 * "Code" es la clave estable para autorizar en código (role.Code ===
 * 'ADMIN'); "Name" es la etiqueta editable y nunca debería usarse para
 * decidir permisos. Ver migrations/README.md.
 */
@Entity('Role')
export class Role extends AuditableEntity {
  @Column({ name: 'Code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'Name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'Description', type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'State', type: 'boolean' })
  state: boolean;

  @Column({ name: 'IsSystemRole', type: 'boolean' })
  isSystemRole: boolean;
}
