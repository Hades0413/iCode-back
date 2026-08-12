import { ApiProperty } from '@nestjs/swagger';
import { CounterReferralStatus } from '../../../domain/enums/counter-referral-status.enum';
import { CounterReferralFormat } from '../../../domain/enums/counter-referral-format.enum';

export class CounterReferralResponseDto {
  @ApiProperty()
  patientId: number;

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

  @ApiProperty()
  uploadedById: number;

  @ApiProperty()
  uploadedAt: string;

  @ApiProperty({ nullable: true })
  sentById: number | null;

  @ApiProperty({ nullable: true })
  sentAt: string | null;
}
