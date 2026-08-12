import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

class TransitionSummarySectionEditDto {
  @ApiProperty({
    description: 'Debe coincidir con el id de una sección ya existente',
  })
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  @Length(0, 4000)
  body: string;
}

/**
 * El servidor ignora cualquier "title"/"hint" que venga del cliente y
 * solo acepta "body" de secciones cuyo "id" ya existe en el documento —
 * no permite redefinir la estructura (ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 3).
 */
export class UpdateTransitionSummaryDto {
  @ApiProperty({ type: [TransitionSummarySectionEditDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransitionSummarySectionEditDto)
  sections: TransitionSummarySectionEditDto[];
}
