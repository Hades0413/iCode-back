import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/** A quién llamar (rol, nombre, teléfono/detalle) — parte de "Mi recorrido". */
@Entity('JourneyContact')
export class JourneyContact extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'Role', type: 'varchar', length: 100 })
  role: string;

  @Column({ name: 'Name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'Detail', type: 'varchar', length: 300, nullable: true })
  detail: string | null;

  @Column({ name: 'DisplayOrder', type: 'int' })
  displayOrder: number;
}
