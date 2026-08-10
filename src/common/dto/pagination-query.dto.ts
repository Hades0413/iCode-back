import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PAGINATION_DEFAULTS } from '../constants/security.constants';

/**
 * Query params estándar para cualquier endpoint de listado paginado.
 * Extendé esta clase si un endpoint necesita filtros propios además de
 * page/limit/order — no la reimplementes.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: PAGINATION_DEFAULTS.PAGE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = PAGINATION_DEFAULTS.PAGE;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: PAGINATION_DEFAULTS.MAX_LIMIT,
    default: PAGINATION_DEFAULTS.LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_DEFAULTS.MAX_LIMIT)
  limit: number = PAGINATION_DEFAULTS.LIMIT;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'DESC';

  /** Para pasarle directo a TypeORM: .skip(query.skip).take(query.limit) */
  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
