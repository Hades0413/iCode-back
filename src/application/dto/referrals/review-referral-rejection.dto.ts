import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ReviewReferralRejectionDto {
  @ApiProperty({ description: 'Motivo del rechazo, para el especialista' })
  @IsString()
  @Length(1, 500)
  notes: string;
}
