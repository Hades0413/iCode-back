import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/**
 * "Exámenes y documentos" — imágenes, PDF, Word o video suelto que se
 * adjunta al caso (radiografías, informes de laboratorio, videos de una
 * evaluación). Muchos por paciente a propósito, a diferencia de
 * "CounterReferral"/"TransitionSummary" (1:1): acá no hay un documento
 * "vigente", son todos los que se fueron sumando. Mismo patrón de disco
 * local que la carta de contrarreferencia, en su propia carpeta (ver
 * PatientAttachmentStorageService).
 */
@Entity('PatientAttachment')
export class PatientAttachment extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'FileName', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'FileSize', type: 'int' })
  fileSize: number;

  @Column({ name: 'StoragePath', type: 'varchar', length: 500 })
  storagePath: string;

  @Column({ name: 'UploadedById', type: 'int' })
  uploadedById: number;

  @Column({ name: 'UploadedAt', type: 'timestamp', precision: 6 })
  uploadedAt: Date;
}
