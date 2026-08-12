import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';
import { ReferralAlertReason } from '../../enums/referral-alert-reason.enum';

/** El especialista reclamándole al área — "Reason" siempre lo recalcula el servidor, nunca el cliente. */
@Entity('ReferralAlert')
export class ReferralAlert extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'Reason', type: 'varchar', length: 20 })
  reason: ReferralAlertReason;

  @Column({ name: 'SentAt', type: 'timestamp', precision: 6 })
  sentAt: Date;

  @Column({ name: 'SentById', type: 'int' })
  sentById: number;
}
