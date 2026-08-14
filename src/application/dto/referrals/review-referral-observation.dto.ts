import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

/** El PDF va aparte, como "file" en el multipart — ver ReferralReviewsController. */
export class ReviewReferralObservationDto {
  @ApiProperty({
    required: false,
    description: 'Qué falta o hay que corregir, además de lo que diga el PDF',
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  notes?: string;
}
