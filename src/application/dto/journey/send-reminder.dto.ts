import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class SendReminderDto {
  @ApiProperty({ maxLength: 240 })
  @IsString()
  @Length(1, 240)
  text: string;
}
