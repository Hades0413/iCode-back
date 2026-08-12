import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetGuardianAccessDto {
  @ApiProperty()
  @IsBoolean()
  hasAccess: boolean;
}
