import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/**
 * Medicación explicada en lenguaje llano para el paciente/tutor — a
 * propósito NO es "ClinicalRecord" (eso es historial técnico para
 * personal de salud, esto es contenido de cara al paciente). Ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 6.
 */
@Entity('JourneyMedication')
export class JourneyMedication extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'Initial', type: 'varchar', length: 10, nullable: true })
  initial: string | null;

  @Column({ name: 'Name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'Dose', type: 'varchar', length: 100, nullable: true })
  dose: string | null;

  @Column({ name: 'Purpose', type: 'varchar', length: 300, nullable: true })
  purpose: string | null;

  @Column({ name: 'DisplayOrder', type: 'int' })
  displayOrder: number;
}
