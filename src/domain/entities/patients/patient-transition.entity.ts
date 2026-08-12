import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';
import { TransitionState } from '../../enums/transition-state.enum';
import { CounterReferralStatus } from '../../enums/counter-referral-status.enum';

/** Lo que ya se sabe de la derivación al hospital de adultos, redactado por la posta. */
export interface HospitalReferralDetails {
  hospital: string;
  specialty: string;
  doctor: string | null;
  referredAt: string;
}

/** La cita ya otorgada por el hospital de adultos. */
export interface AppointmentDetails {
  hospital: string;
  specialist: string;
  date: string;
  reason: string;
  managedBy: string;
}

/**
 * Extiende a "Patient" 1:1 con todo lo propio del recorrido
 * pediátrico→adultos ("Puente 18+" versión front, ver
 * PUENTE18_FRONTEND_INTEGRATION.md) — deliberadamente en tabla propia y
 * no como columnas en "Patient": ese dominio de identidad/consentimiento
 * ya existe y no debe mezclarse con este (dos relojes que casualmente
 * comparten el disparador de los 18 años, ver TitleTransferService).
 *
 * "HospitalReferral"/"Appointment" van en jsonb en vez de tablas propias
 * — mismo criterio que "ClinicalRecord.Details": son un snapshot de lo
 * que la posta/hospital informan, no un recurso con su propio ciclo de
 * vida ni historial de cambios en este prototipo.
 */
@Entity('PatientTransition')
export class PatientTransition extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'State', type: 'varchar', length: 30 })
  state: TransitionState;

  @Column({ name: 'MedicalRecordNumber', type: 'varchar', length: 30 })
  medicalRecordNumber: string;

  /**
   * Snapshot de texto libre para la columna "Diagnóstico" del tablero —
   * a propósito no deriva de "ClinicalRecord" (eso obligaría a este
   * módulo a depender de ClinicalRecordsModule solo para una etiqueta
   * descriptiva; un paciente puede tener varios ítems DIAGNOSTICO y acá
   * hace falta uno solo, corto, para la fila).
   */
  @Column({
    name: 'PrimaryDiagnosis',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  primaryDiagnosis: string | null;

  @Column({ name: 'SpecialtyId', type: 'int' })
  specialtyId: number;

  /** Quién la firma habitualmente — puede reasignarse, no es autoría. */
  @Column({ name: 'AttendingStaffId', type: 'int', nullable: true })
  attendingStaffId: number | null;

  /** Domicilio del paciente, solo para asignar la posta más cercana — no vive en "Patient" (no es identidad, es logística de este dominio). */
  @Column({ name: 'District', type: 'varchar', length: 100, nullable: true })
  district: string | null;

  @Column({ name: 'HealthPostFacilityId', type: 'int', nullable: true })
  healthPostFacilityId: number | null;

  @Column({
    name: 'HealthPostDistanceKm',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  healthPostDistanceKm: string | null;

  @Column({
    name: 'ReferredToPostAt',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  referredToPostAt: Date | null;

  @Column({ name: 'HospitalReferral', type: 'jsonb', nullable: true })
  hospitalReferral: HospitalReferralDetails | null;

  @Column({ name: 'Appointment', type: 'jsonb', nullable: true })
  appointment: AppointmentDetails | null;

  /**
   * Detalle de la cita de cara al paciente ("Mi recorrido") — a
   * propósito NO va dentro de "Appointment" (eso es lo que informa el
   * hospital de adultos; esto es la elaboración para que el paciente
   * sepa a dónde ir y a qué hora llegar).
   */
  @Column({
    name: 'AppointmentAddress',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  appointmentAddress: string | null;

  @Column({ name: 'ArriveMinutesEarly', type: 'int', nullable: true })
  arriveMinutesEarly: number | null;

  @Column({
    name: 'AdmissionNote',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  admissionNote: string | null;

  @Column({ name: 'CounterReferralStatus', type: 'varchar', length: 10 })
  counterReferralStatus: CounterReferralStatus | 'NONE';
}
