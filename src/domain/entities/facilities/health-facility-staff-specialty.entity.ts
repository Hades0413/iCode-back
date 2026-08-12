import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/**
 * Qué especialidades cubre un miembro del personal de salud — muchos a
 * muchos a propósito: un médico real puede atender más de una
 * especialidad, a diferencia de "PatientTransition.SpecialtyId" que es
 * una sola por paciente (ver medical-specialty.entity.ts).
 */
@Entity('HealthFacilityStaffSpecialty')
export class HealthFacilityStaffSpecialty extends AuditableEntity {
  @Column({ name: 'HealthFacilityStaffId', type: 'int' })
  healthFacilityStaffId: number;

  @Column({ name: 'MedicalSpecialtyId', type: 'int' })
  medicalSpecialtyId: number;
}
