import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AuthorizationScope } from '../../../domain/enums/authorization-scope.enum';

/**
 * Query params del endpoint simulado de consulta por un centro de salud
 * (requisito #4). "IsEmergency" solo tiene efecto sobre alcance BASICA
 * (ver AccessDecisionService) — para SENSIBLE nunca hay excepción de
 * emergencia, sin importar este flag.
 */
export class QueryClinicalSummaryDto {
  @ApiProperty({
    enum: AuthorizationScope,
    description: 'Qué nivel de información se está solicitando',
  })
  @IsEnum(AuthorizationScope)
  scope: AuthorizationScope;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'Declara que es una consulta de emergencia con riesgo de vida — habilita la excepción legal solo para información BASICA',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isEmergency?: boolean;
}
