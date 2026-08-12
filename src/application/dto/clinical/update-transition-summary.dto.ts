import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
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

  /**
   * iCode-front manda la sección COMPLETA (id/title/body/hint, ver
   * ClinicalSummarySection) — con "forbidNonWhitelisted: true" en el
   * ValidationPipe global (ver main.ts), no declarar estos dos campos
   * haría que cualquier PUT del front se rechace con 400. El servidor
   * los acepta pero los ignora (ver el comentario de más abajo): la
   * estructura del documento no se redefine desde el cliente.
   */
  @ApiProperty({
    required: false,
    description:
      'Se acepta pero se ignora — la estructura no la define el cliente',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false, description: 'Se acepta pero se ignora' })
  @IsOptional()
  @IsString()
  hint?: string;
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
