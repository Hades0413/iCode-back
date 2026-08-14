import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';
import { ReferralReviewStatus } from '../../enums/referral-review-status.enum';

/**
 * Lo que el área de Referencias registra sobre la respuesta del destino a
 * la historia clínica de transferencia — 1:1 con "Patient"
 * ("UQ_ReferralReview_Patient"), mismo criterio que "CounterReferral". Si
 * observó algo, "FileName"/"StoragePath" traen el PDF con el detalle
 * (mismo patrón de disco local que la carta, ver
 * CounterReferralStorageService); si aceptó o rechazó, esos campos
 * quedan null — no hay documento que adjuntar.
 */
@Entity('ReferralReview')
export class ReferralReview extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'Status', type: 'varchar', length: 10 })
  status: ReferralReviewStatus;

  @Column({ name: 'Notes', type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'FileName', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ name: 'FileSize', type: 'int', nullable: true })
  fileSize: number | null;

  @Column({
    name: 'StoragePath',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  storagePath: string | null;

  @Column({ name: 'ReviewedById', type: 'int' })
  reviewedById: number;

  @Column({ name: 'ReviewedAt', type: 'timestamp', precision: 6 })
  reviewedAt: Date;
}
