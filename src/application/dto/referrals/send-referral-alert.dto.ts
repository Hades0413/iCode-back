import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ReferralAlertReason } from '../../../domain/enums/referral-alert-reason.enum';

/**
 * "Reason" es opcional y, si viene, tiene que coincidir con lo que el
 * servidor calcula solo (ver ReferralService.pendingReferralAction) —
 * nunca lo elige el cliente. Ver PUENTE18_FRONTEND_INTEGRATION.md,
 * sección 4.
 */
export class SendReferralAlertDto {
  @ApiProperty({ enum: ReferralAlertReason, required: false })
  @IsOptional()
  @IsEnum(ReferralAlertReason)
  reason?: ReferralAlertReason;
}
