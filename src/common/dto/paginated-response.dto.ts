import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

/**
 * Solo para documentar en Swagger la forma de una respuesta paginada — la
 * lógica real vive en paginate.util.ts. Un controller la usa así:
 *
 *   @ApiExtraModels(PaginationMetaDto)
 *   @ApiOkResponse({
 *     schema: {
 *       allOf: [
 *         { properties: { meta: { $ref: getSchemaPath(PaginationMetaDto) } } },
 *         { properties: { data: { type: 'array', items: { $ref: getSchemaPath(MiDto) } } } },
 *       ],
 *     },
 *   })
 */
export class PaginatedResponseDto {
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
