import { ApiProperty } from '@nestjs/swagger';
import { CounterReferralStatus } from '../../../domain/enums/counter-referral-status.enum';
import { CounterReferralFormat } from '../../../domain/enums/counter-referral-format.enum';
import { PatientTransitionResponseDto } from '../transition/patient-transition-response.dto';

/**
 * `patientId: string` y `uploadedBy`/`sentBy` como nombre resuelto —
 * así lo declara `CounterReferral` en iCode-front (ver
 * domain/entities/referral.entity.ts de ese repo), mismo criterio que
 * `TransitionSummaryResponseDto`.
 */
export class CounterReferralResponseDto {
  @ApiProperty({
    description:
      'String — así lo espera CounterReferral.patientId de iCode-front',
  })
  patientId: string;

  @ApiProperty({ enum: CounterReferralStatus })
  status: CounterReferralStatus;

  @ApiProperty()
  fileName: string;

  @ApiProperty({ enum: CounterReferralFormat })
  format: CounterReferralFormat;

  @ApiProperty()
  fileSize: number;

  @ApiProperty({ nullable: true })
  code: string | null;

  @ApiProperty({ description: 'Nombre resuelto de quien subió el archivo' })
  uploadedBy: string;

  @ApiProperty()
  uploadedAt: string;

  @ApiProperty({
    nullable: true,
    description:
      'Nombre resuelto de quien la envió — null si todavía no se envió',
  })
  sentBy: string | null;

  @ApiProperty({ nullable: true })
  sentAt: string | null;
}

/**
 * Lo que devuelven POST (subir) y POST .../delivery (enviar) — el
 * documento Y la fila del paciente juntos, mismo criterio que
 * ClinicalSummaryResultDto (ver CounterReferralResult en
 * application/dto/counter-referral-result.dto.ts de iCode-front).
 */
export class CounterReferralResultDto {
  @ApiProperty({ type: PatientTransitionResponseDto })
  patient: PatientTransitionResponseDto;

  @ApiProperty({ type: CounterReferralResponseDto })
  counterReferral: CounterReferralResponseDto;
}
