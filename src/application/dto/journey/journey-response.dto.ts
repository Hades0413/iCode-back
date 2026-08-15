import { ApiProperty } from '@nestjs/swagger';
import { TransitionState } from '../../../domain/enums/transition-state.enum';
import { ReferralReviewStatus } from '../../../domain/enums/referral-review-status.enum';
import { HealthPostSummaryDto } from '../transition/patient-transition-response.dto';
import { AppointmentDetails } from '../../../domain/entities/patients/patient-transition.entity';

export class JourneyChecklistItemDto {
  @ApiProperty({
    description:
      'String — así lo espera JourneyChecklistItem.id de iCode-front',
  })
  id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) detail: string | null;
  @ApiProperty({ nullable: true }) pendingLabel: string | null;
  @ApiProperty() done: boolean;
}

export class JourneyMedicationDto {
  @ApiProperty({ nullable: true }) initial: string | null;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) dose: string | null;
  @ApiProperty({ nullable: true }) purpose: string | null;
}

export class JourneyAllergyDto {
  @ApiProperty() substance: string;
  @ApiProperty({ nullable: true }) detail: string | null;
}

export class JourneyContactDto {
  @ApiProperty() role: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) detail: string | null;
}

export class JourneyGuideEntryDto {
  @ApiProperty() question: string;
  @ApiProperty() answer: string;
}

export class JourneyMessageDto {
  @ApiProperty({
    description: 'String — así lo espera JourneyMessage.id de iCode-front',
  })
  id: string;
  @ApiProperty() text: string;
  @ApiProperty() sentAt: string;
  @ApiProperty({
    description:
      'El parentesco de quien lo mandó, no un nombre — "tu madre" (ver domain/entities/journey.entity.ts de iCode-front)',
  })
  from: string;
}

export class JourneyGuardianDto {
  @ApiProperty() firstName: string;
  @ApiProperty() relationship: string;
  @ApiProperty() hasAccess: boolean;
}

export class JourneyViewerDto {
  @ApiProperty({ enum: ['OWNER', 'GUARDIAN'] })
  role: 'OWNER' | 'GUARDIAN';

  @ApiProperty()
  relationship: string;

  @ApiProperty()
  canEditChecklist: boolean;

  @ApiProperty()
  canSendReminder: boolean;

  @ApiProperty()
  canManageGuardianAccess: boolean;

  @ApiProperty()
  canReportAppointment: boolean;

  @ApiProperty()
  canManageConsultationCode: boolean;
}

export class TransitionJourneyDto {
  @ApiProperty() patientId: number;
  @ApiProperty() initials: string;
  @ApiProperty() age: string;
  @ApiProperty({ enum: TransitionState }) state: TransitionState;
  @ApiProperty({ description: 'El diagnóstico técnico' }) diagnosis: string;
  @ApiProperty({
    description:
      'El mismo diagnóstico en lenguaje llano — hoy es un placeholder (mismo texto que "diagnosis"), ver la nota en JourneyService',
  })
  diagnosisPlain: string;
  @ApiProperty({ description: 'Qué seguir vigilando y cada cuánto' })
  followUp: string;
  @ApiProperty({
    description:
      'Nombre resuelto — quien armó el resumen y sigue disponible para dudas',
  })
  attendingDoctor: string;
  @ApiProperty() specialty: string;
  @ApiProperty({ type: [JourneyMedicationDto] })
  medications: JourneyMedicationDto[];
  @ApiProperty({ type: [JourneyAllergyDto] }) allergies: JourneyAllergyDto[];
  @ApiProperty({ type: [JourneyContactDto] }) contacts: JourneyContactDto[];
  @ApiProperty({ type: [JourneyChecklistItemDto] })
  checklist: JourneyChecklistItemDto[];
  @ApiProperty({ type: [JourneyGuideEntryDto] }) guide: JourneyGuideEntryDto[];
  @ApiProperty({ type: HealthPostSummaryDto, nullable: true })
  healthPost: HealthPostSummaryDto | null;
  @ApiProperty({ nullable: true }) appointment: AppointmentDetails | null;
  @ApiProperty({ nullable: true }) appointmentAddress: string | null;
  @ApiProperty({
    description: 'Nunca null — 0 si no hay dato (el front lo declara number)',
  })
  arriveMinutesEarly: number;
  @ApiProperty({ nullable: true }) admissionNote: string | null;
  @ApiProperty() summaryApproved: boolean;

  @ApiProperty({
    enum: ReferralReviewStatus,
    enumName: 'ReferralReviewStatusOrNone',
    description:
      'Qué contestó el destino sobre su referencia, el mismo valor que la columna "Estado referencia" del tablero. "NONE" = todavía no la revisaron. Manda sobre la única acción de la app del paciente: hasta que no está ACCEPTED no hay cita que registrar.',
  })
  referralReviewStatus: ReferralReviewStatus | 'NONE';

  @ApiProperty({
    nullable: true,
    description:
      'Quién aceptó la referencia, para poder nombrarlo ("Hospital Sergio Bernales aceptó tu referencia"). null mientras no esté aceptada.',
  })
  referralAcceptedBy: string | null;
  @ApiProperty({ type: JourneyGuardianDto, nullable: true })
  guardian: JourneyGuardianDto | null;
  @ApiProperty({ type: JourneyMessageDto, nullable: true })
  pendingMessage: JourneyMessageDto | null;

  @ApiProperty({
    nullable: true,
    description:
      'Código único para que un médico vea el resumen clínico sin pedir el documento — null hasta que el paciente lo genere, o si el que tenía ya venció',
  })
  consultationCode: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'ISO 8601 — cuándo vence "consultationCode" (dura 15 minutos). Null si consultationCode es null.',
  })
  consultationCodeExpiresAt: string | null;
}

export class JourneyAccessResponseDto {
  @ApiProperty({ enum: ['GRANTED', 'REVOKED'] })
  access: 'GRANTED' | 'REVOKED';

  @ApiProperty({ type: JourneyViewerDto })
  viewer: JourneyViewerDto;

  @ApiProperty({
    type: TransitionJourneyDto,
    required: false,
    description: 'Solo si access === GRANTED',
  })
  journey?: TransitionJourneyDto;

  @ApiProperty({
    required: false,
    description: 'Solo si access === REVOKED',
  })
  subjectInitials?: string;
}
