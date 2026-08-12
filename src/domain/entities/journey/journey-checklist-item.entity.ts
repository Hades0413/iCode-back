import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/**
 * Un ítem de preparación del propio paciente ("Mi recorrido"). "Done"
 * solo lo puede tildar el paciente titular — nunca su tutor, ver
 * JourneyService.setChecklistItemDone (CHECKLIST_WRITE es un permiso que
 * el rol de tutor no tiene).
 */
@Entity('JourneyChecklistItem')
export class JourneyChecklistItem extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'Title', type: 'varchar', length: 150 })
  title: string;

  @Column({ name: 'Detail', type: 'varchar', length: 500, nullable: true })
  detail: string | null;

  @Column({
    name: 'PendingLabel',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  pendingLabel: string | null;

  @Column({ name: 'Done', type: 'boolean' })
  done: boolean;

  @Column({ name: 'DisplayOrder', type: 'int' })
  displayOrder: number;
}
