import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';
import { ClinicalRecordType } from '../../enums/clinical-record-type.enum';
import { SensitivityLevel } from '../../enums/sensitivity-level.enum';

/**
 * Un ítem del historial resumido (diagnóstico, medicación, alergia,
 * cirugía o examen clave — "RecordType"). "SensitivityLevel" es POR
 * REGISTRO, no por tipo: dos diagnósticos del mismo paciente pueden tener
 * niveles distintos (ej. "Asma" = BASICA, "VIH" = SENSIBLE) — ver
 * domain/enums/sensitivity-level.enum.ts. Ese nivel es lo que
 * AccessDecisionService usa para decidir si una consulta externa puede
 * ver este ítem.
 *
 * "Details" guarda lo específico de cada tipo (dosis/frecuencia,
 * severidad de reacción, resultado de examen...) sin necesitar una tabla
 * por tipo — tradeoff deliberado para no sobre-diseñar un prototipo de
 * hackatón con 5 CRUDs casi idénticos.
 */
@Entity('ClinicalRecord')
export class ClinicalRecord extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'RecordType', type: 'varchar', length: 20 })
  recordType: ClinicalRecordType;

  @Column({ name: 'SensitivityLevel', type: 'varchar', length: 20 })
  sensitivityLevel: SensitivityLevel;

  @Column({ name: 'Title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'Details', type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @Column({ name: 'OccurredAt', type: 'date', nullable: true })
  occurredAt: string | null;

  @Column({ name: 'HealthFacilityId', type: 'int', nullable: true })
  healthFacilityId: number | null;

  @Column({ name: 'RecordedByUserId', type: 'int', nullable: true })
  recordedByUserId: number | null;
}
