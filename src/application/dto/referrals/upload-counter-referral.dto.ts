import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { CounterReferralFormat } from '../../../domain/enums/counter-referral-format.enum';

/** El archivo va aparte, como "file" en el multipart — ver CounterReferralsController. */
export class UploadCounterReferralDto {
  @ApiProperty({ enum: CounterReferralFormat })
  @IsEnum(CounterReferralFormat)
  format: CounterReferralFormat;

  @ApiProperty({
    required: false,
    description: 'Número de carta del sistema externo, si ya se conoce',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  code?: string;
}
