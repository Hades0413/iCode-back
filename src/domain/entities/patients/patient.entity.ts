import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';
import { Sex } from '../../enums/sex.enum';

/**
 * El sujeto clínico, NO una cuenta de acceso: un paciente puede existir
 * sin "UserId" (típico mientras es menor y nunca inició sesión él mismo,
 * solo su tutor). "UserId" se completa cuando el propio paciente tiene
 * login — recién al cumplir 18 (ver TitleTransferService) o si ya lo
 * tenía desde antes.
 *
 * Todos los datos de este módulo son ficticios/sintéticos por regla
 * obligatoria del hackatón (ver prompt_contexto_backend_puente18.md) —
 * nunca se cargan aquí datos reales de pacientes.
 */
@Entity('Patient')
export class Patient extends AuditableEntity {
  @Column({ name: 'DocumentType', type: 'varchar', length: 20 })
  documentType: string;

  @Column({ name: 'DocumentNumber', type: 'varchar', length: 20 })
  documentNumber: string;

  @Column({ name: 'FirstName', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'LastName', type: 'varchar', length: 100 })
  lastName: string;

  @Column({ name: 'DateOfBirth', type: 'date' })
  dateOfBirth: string;

  @Column({ name: 'BloodType', type: 'varchar', length: 5, nullable: true })
  bloodType: string | null;

  /** Agregado para el dominio de transición pediátrico→adultos (ver PatientTransition) — dato de identidad genuino, a diferencia de "MedicalRecordNumber" que sí es propio de ese dominio. */
  @Column({ name: 'Sex', type: 'varchar', length: 1, nullable: true })
  sex: Sex | null;

  @Column({ name: 'UserId', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'State', type: 'boolean' })
  state: boolean;
}
