import { ApiProperty } from '@nestjs/swagger';
import { TransitionState } from '../../../domain/enums/transition-state.enum';
import { HealthPostSummaryDto } from '../transition/patient-transition-response.dto';
import { AppointmentDetails } from '../../../domain/entities/patients/patient-transition.entity';

export class JourneyChecklistItemDto {
  @ApiProperty() id: number;
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
  @ApiProperty() id: number;
  @ApiProperty() text: string;
  @ApiProperty() sentAt: string;
  @ApiProperty({ description: 'Id de "User" — quien lo mandó' })
  sentById: number;
}

export class JourneyGuardianDto {
  @ApiProperty({ nullable: true }) firstName: string | null;
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
}

export class TransitionJourneyDto {
  @ApiProperty() patientId: number;
  @ApiProperty() initials: string;
  @ApiProperty() age: string;
  @ApiProperty({ enum: TransitionState }) state: TransitionState;
  @ApiProperty({ nullable: true }) diagnosis: string | null;
  @ApiProperty() attendingStaffId: number | null;
  @ApiProperty() specialtyName: string;
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
  @ApiProperty({ nullable: true }) arriveMinutesEarly: number | null;
  @ApiProperty({ nullable: true }) admissionNote: string | null;
  @ApiProperty() summaryApproved: boolean;
  @ApiProperty({ type: JourneyGuardianDto, nullable: true })
  guardian: JourneyGuardianDto | null;
  @ApiProperty({ type: JourneyMessageDto, nullable: true })
  pendingMessage: JourneyMessageDto | null;
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
