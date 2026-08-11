import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { AuthorizationScope } from '../../../domain/enums/authorization-scope.enum';

export class CreateAccessAuthorizationDto {
  @ApiProperty({ description: 'IPRESS a la que se autoriza el acceso' })
  @IsInt()
  healthFacilityId: number;

  @ApiProperty({ enum: AuthorizationScope })
  @IsEnum(AuthorizationScope)
  scope: AuthorizationScope;

  @ApiProperty({
    required: false,
    description: 'Vigencia — indefinida si se omite',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
