import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/**
 * Recordatorio que el tutor le manda al paciente. "DeletedAt" (heredado
 * de AuditableEntity) se usa para "el paciente lo descartó" — no es un
 * borrado administrativo, es la acción de negocio de
 * "DELETE /journey/messages/:id" (solo el OWNER puede, ver JourneyService).
 */
@Entity('JourneyMessage')
export class JourneyMessage extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'Text', type: 'varchar', length: 240 })
  text: string;

  @Column({ name: 'SentById', type: 'int' })
  sentById: number;

  @Column({ name: 'SentAt', type: 'timestamp', precision: 6 })
  sentAt: Date;
}
