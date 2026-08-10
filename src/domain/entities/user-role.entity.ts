import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from './base/auditable.entity';
import { User } from './user.entity';
import { Role } from './role.entity';

/**
 * Un usuario puede tener varios roles (por eso esto es una tabla de
 * unión, no una columna en User). Ver migrations/README.md — los
 * permisos efectivos de un usuario son la unión de los de todos sus
 * roles, resuelta en la vista "UserPermission" (ver
 * PermissionGuard/permission.guard.ts), no acá.
 */
@Entity('UserRole')
export class UserRole extends AuditableEntity {
  @Column({ name: 'UserId', type: 'int' })
  userId: number;

  @Column({ name: 'RoleId', type: 'int' })
  roleId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'UserId' })
  user: User;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'RoleId' })
  role: Role;
}
