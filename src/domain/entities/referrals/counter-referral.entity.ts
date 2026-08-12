import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';
import { CounterReferralStatus } from '../../enums/counter-referral-status.enum';
import { CounterReferralFormat } from '../../enums/counter-referral-format.enum';

/**
 * La carta de contrarreferencia — 1:1 con "Patient"
 * ("UQ_CounterReferral_Patient"). "StoragePath" es la ruta dentro del
 * volumen de disco local (ver docker-compose, decisión registrada en
 * PUENTE18_FRONTEND_INTEGRATION.md) — nunca se expone tal cual al
 * cliente, solo a través de un endpoint de descarga que la resuelve.
 * Subir y enviar son dos actos separados con su propio autor/fecha —
 * "SentAt" nulo significa que todavía no salió, aunque ya esté subida.
 */
@Entity('CounterReferral')
export class CounterReferral extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'Status', type: 'varchar', length: 10 })
  status: CounterReferralStatus;

  @Column({ name: 'FileName', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'Format', type: 'varchar', length: 10 })
  format: CounterReferralFormat;

  @Column({ name: 'FileSize', type: 'int' })
  fileSize: number;

  @Column({ name: 'StoragePath', type: 'varchar', length: 500 })
  storagePath: string;

  @Column({ name: 'Code', type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ name: 'UploadedById', type: 'int' })
  uploadedById: number;

  @Column({ name: 'UploadedAt', type: 'timestamp', precision: 6 })
  uploadedAt: Date;

  @Column({ name: 'SentById', type: 'int', nullable: true })
  sentById: number | null;

  @Column({ name: 'SentAt', type: 'timestamp', precision: 6, nullable: true })
  sentAt: Date | null;
}
