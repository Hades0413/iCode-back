import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/**
 * Catálogo de especialidades médicas (ej. "Oncología pediátrica"). Un
 * médico puede cubrir más de una (ver "HealthFacilityStaffSpecialty") y
 * un paciente en transición pertenece a exactamente una (ver
 * "PatientTransition.SpecialtyId") — es esa segunda relación la que
 * decide qué cohorte ve cada especialista (nunca el cliente).
 *
 * "AdultName" es solo una etiqueta alternativa ("Oncología de adultos"
 * para "Oncología pediátrica") — nunca se guarda un segundo catálogo ni
 * se reasigna "PatientTransition.SpecialtyId" al cumplir 18: el nombre
 * efectivo se calcula siempre a partir de "isAdult" (ver
 * PatientTransitionService), mismo criterio que "TitleTransferService.isAdult" —
 * nada de esto es un estado que alguien tenga que actualizar a mano.
 */
@Entity('MedicalSpecialty')
export class MedicalSpecialty extends AuditableEntity {
  @Column({ name: 'Code', type: 'varchar', length: 30 })
  code: string;

  @Column({ name: 'Name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'AdultName', type: 'varchar', length: 150, nullable: true })
  adultName: string | null;

  @Column({ name: 'State', type: 'boolean' })
  state: boolean;
}
