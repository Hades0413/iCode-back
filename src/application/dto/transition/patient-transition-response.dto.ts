import { ApiProperty } from '@nestjs/swagger';
import { TransitionState } from '../../../domain/enums/transition-state.enum';
import { ClinicalSummaryStatus } from '../../../domain/enums/clinical-summary-status.enum';
import { CounterReferralStatus } from '../../../domain/enums/counter-referral-status.enum';
import { ReferralAlertReason } from '../../../domain/enums/referral-alert-reason.enum';
import {
  AppointmentDetails,
  HospitalReferralDetails,
} from '../../../domain/entities/patients/patient-transition.entity';

export class PostNoticeSummaryDto {
  @ApiProperty()
  sentAt: string;

  @ApiProperty({ description: 'Id de "User" — para el resto del backend' })
  sentById: number;

  @ApiProperty({ description: 'Nombre resuelto — lo que espera iCode-front' })
  sentBy: string;
}

export class ReferralAlertSummaryDto {
  @ApiProperty()
  sentAt: string;

  @ApiProperty({ description: 'Id de "User" — para el resto del backend' })
  sentById: number;

  @ApiProperty({ description: 'Nombre resuelto — lo que espera iCode-front' })
  sentBy: string;

  @ApiProperty({ enum: ReferralAlertReason })
  reason: ReferralAlertReason;
}

export class HealthPostSummaryDto {
  @ApiProperty({
    description: 'String — así lo espera HealthPost.id de iCode-front',
  })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  district: string;

  @ApiProperty()
  distanceKm: number;
}

/**
 * Una fila de la cohorte o el detalle de un caso — todo lo que en el
 * mock del front era una columna plana de "Patient" pero acá SIEMPRE se
 * calcula al armar la respuesta (edad, meses para 18, progreso del
 * resumen, última acción): ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 2, sobre por qué esos
 * valores nunca se guardan como columna.
 *
 * Tiene MÁS campos de los que declara `Patient` en iCode-front a
 * propósito: `id`/`initials`/`dni`/`medicalRecord`/`diagnosis`/
 * `specialty`/`attendingDoctor` son alias en el shape exacto que el
 * front espera (ver domain/entities/patient.entity.ts de iCode-front);
 * `patientId`/`documentNumber`/`medicalRecordNumber`/`primaryDiagnosis`/
 * `specialtyName`/`attendingStaffId` siguen existiendo tal cual porque
 * el resto de los servicios de este backend (TransitionSummaryService,
 * JourneyService...) ya los usan — un campo de más en el JSON no rompe
 * a nadie, así que se agregó en vez de renombrar.
 */
export class PatientTransitionResponseDto {
  @ApiProperty({
    description: 'Alias string de patientId — así lo espera iCode-front',
  })
  id: string;

  @ApiProperty()
  patientId: number;

  @ApiProperty()
  documentNumber: string;

  @ApiProperty({ description: 'Alias de documentNumber' })
  dni: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({
    description:
      'Dos letras — el front no muestra el nombre completo en la tabla',
  })
  initials: string;

  @ApiProperty({ nullable: true })
  sex: string | null;

  @ApiProperty()
  medicalRecordNumber: string;

  @ApiProperty({ description: 'Alias de medicalRecordNumber' })
  medicalRecord: string;

  @ApiProperty({ nullable: true })
  primaryDiagnosis: string | null;

  @ApiProperty({
    description: "Alias de primaryDiagnosis, nunca null ('' si no hay)",
  })
  diagnosis: string;

  @ApiProperty({ description: 'Ej. "17a 11m" — ya formateada por el servidor' })
  age: string;

  @ApiProperty({
    description:
      'Positivo = faltan N meses para los 18; 0 o negativo = ya cumplió hace |N| meses',
  })
  monthsToEighteen: number;

  @ApiProperty({ nullable: true })
  turnedEighteenAt: string | null;

  @ApiProperty()
  isAdult: boolean;

  @ApiProperty()
  specialtyId: number;

  @ApiProperty()
  specialtyName: string;

  @ApiProperty({ description: 'Alias de specialtyName' })
  specialty: string;

  @ApiProperty({
    nullable: true,
    description: 'Id de "HealthFacilityStaff" — para el resto del backend',
  })
  attendingStaffId: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'Nombre resuelto del médico a cargo — lo que espera iCode-front',
  })
  attendingDoctor: string | null;

  @ApiProperty({ nullable: true })
  district: string | null;

  @ApiProperty({ enum: TransitionState })
  state: TransitionState;

  @ApiProperty({
    enum: ClinicalSummaryStatus,
    enumName: 'ClinicalSummaryStatusOrNone',
  })
  summaryStatus: ClinicalSummaryStatus | 'NONE';

  @ApiProperty({
    description: '0..1, 0.85 es el techo de un borrador sin firmar',
  })
  summaryProgress: number;

  @ApiProperty({ type: HealthPostSummaryDto, nullable: true })
  healthPost: HealthPostSummaryDto | null;

  @ApiProperty({ nullable: true })
  referredToPostAt: string | null;

  @ApiProperty({ nullable: true })
  daysWaitingOnPost: number | null;

  @ApiProperty({ nullable: true })
  hospitalReferral: HospitalReferralDetails | null;

  @ApiProperty({ nullable: true })
  appointment: AppointmentDetails | null;

  @ApiProperty({
    enum: CounterReferralStatus,
    enumName: 'CounterReferralStatusOrNone',
  })
  counterReferralStatus: CounterReferralStatus | 'NONE';

  @ApiProperty({
    description:
      'Lo más reciente entre avisos, reclamos, resumen y carta — nunca null (el front lo declara string)',
  })
  lastAction: string;

  @ApiProperty({
    nullable: true,
    description:
      '0..1, avance del checklist de preparación del propio paciente. null si no tiene ítems.',
  })
  checklistProgress: number | null;

  @ApiProperty({
    type: [PostNoticeSummaryDto],
    description:
      'Historial completo — el front lo necesita para sus propias reglas (hasPostNotice, referralSummary)',
  })
  postNotices: PostNoticeSummaryDto[];

  @ApiProperty({ type: [ReferralAlertSummaryDto] })
  referralAlerts: ReferralAlertSummaryDto[];
}
