import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from './base/auditable.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity('RolePermission')
export class RolePermission extends AuditableEntity {
  @Column({ name: 'RoleId', type: 'int' })
  roleId: number;

  @Column({ name: 'PermissionId', type: 'int' })
  permissionId: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'RoleId' })
  role: Role;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: 'PermissionId' })
  permission: Permission;
}
