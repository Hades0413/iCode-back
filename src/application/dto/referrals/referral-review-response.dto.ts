import { ApiProperty } from '@nestjs/swagger';
import { ReferralReviewStatus } from '../../../domain/enums/referral-review-status.enum';
import { PatientTransitionResponseDto } from '../transition/patient-transition-response.dto';

/**
 * `patientId: string` y `reviewedBy` como nombre resuelto — mismo
 * criterio que `CounterReferralResponseDto`/`TransitionSummaryResponseDto`.
 */
export class ReferralReviewResponseDto {
  @ApiProperty({
    description:
      'String — mismo criterio que CounterReferral.patientId en iCode-front',
  })
  patientId: string;

  @ApiProperty({ enum: ReferralReviewStatus })
  status: ReferralReviewStatus;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty({
    nullable: true,
    description: 'El PDF adjunto — solo cuando la revisión fue OBSERVED',
  })
  fileName: string | null;

  @ApiProperty({ nullable: true })
  fileSize: number | null;

  @ApiProperty({ description: 'Nombre resuelto de quien revisó' })
  reviewedBy: string;

  @ApiProperty()
  reviewedAt: string;
}

/**
 * Lo que devuelven los 3 POST de revisión — el documento Y la fila del
 * paciente juntos, mismo criterio que CounterReferralResultDto.
 */
export class ReferralReviewResultDto {
  @ApiProperty({ type: PatientTransitionResponseDto })
  patient: PatientTransitionResponseDto;

  @ApiProperty({ type: ReferralReviewResponseDto })
  referralReview: ReferralReviewResponseDto;
}
