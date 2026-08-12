import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/** Alergias en lenguaje llano para "Mi recorrido" — ver journey-medication.entity.ts sobre por qué no reutiliza "ClinicalRecord". */
@Entity('JourneyAllergy')
export class JourneyAllergy extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'Substance', type: 'varchar', length: 150 })
  substance: string;

  @Column({ name: 'Detail', type: 'varchar', length: 300, nullable: true })
  detail: string | null;

  @Column({ name: 'DisplayOrder', type: 'int' })
  displayOrder: number;
}
