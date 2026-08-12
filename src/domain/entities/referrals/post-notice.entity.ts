import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/**
 * Historial de avisos del área de Referencias a la posta del distrito.
 * Se permite más de una fila por paciente (un aviso "tarde" después de
 * los 18 sigue siendo válido, ver ReferralRulesService) — la más
 * reciente es la que importa para "hace cuántos días se avisó".
 */
@Entity('PostNotice')
export class PostNotice extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'SentAt', type: 'timestamp', precision: 6 })
  sentAt: Date;

  @Column({ name: 'SentById', type: 'int' })
  sentById: number;
}
