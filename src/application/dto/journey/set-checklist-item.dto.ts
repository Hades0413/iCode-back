import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetChecklistItemDto {
  @ApiProperty()
  @IsBoolean()
  done: boolean;
}
