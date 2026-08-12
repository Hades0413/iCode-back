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

  @ApiProperty({ description: 'Id de "User" — quien avisó' })
  sentById: number;
}

export class ReferralAlertSummaryDto {
  @ApiProperty()
  sentAt: string;

  @ApiProperty({ description: 'Id de "User" — quien reclamó' })
  sentById: number;

  @ApiProperty({ enum: ReferralAlertReason })
  reason: ReferralAlertReason;
}

export class HealthPostSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  district: string | null;

  @ApiProperty({ nullable: true })
  distanceKm: number | null;
}

/**
 * Una fila de la cohorte o el detalle de un caso — todo lo que en el
 * mock del front era una columna plana de "Patient" pero acá SIEMPRE se
 * calcula al armar la respuesta (edad, meses para 18, progreso del
 * resumen, última acción): ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 2, sobre por qué esos
 * valores nunca se guardan como columna.
 */
export class PatientTransitionResponseDto {
  @ApiProperty()
  patientId: number;

  @ApiProperty()
  documentNumber: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ nullable: true })
  sex: string | null;

  @ApiProperty()
  medicalRecordNumber: string;

  @ApiProperty({ nullable: true })
  primaryDiagnosis: string | null;

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

  @ApiProperty({
    nullable: true,
    description:
      'Id de "HealthFacilityStaff" — el nombre del especialista se resuelve aparte (ver GET /users/:id), este módulo nunca desnormaliza nombres de "User", igual que LegalGuardian/ClinicalRecord',
  })
  attendingStaffId: number | null;

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
    nullable: true,
    description: 'Lo más reciente entre avisos, reclamos, resumen y carta',
  })
  lastAction: string | null;

  @ApiProperty({
    type: [PostNoticeSummaryDto],
    description:
      'Historial completo — el front lo necesita para sus propias reglas (hasPostNotice, referralSummary)',
  })
  postNotices: PostNoticeSummaryDto[];

  @ApiProperty({ type: [ReferralAlertSummaryDto] })
  referralAlerts: ReferralAlertSummaryDto[];
}
