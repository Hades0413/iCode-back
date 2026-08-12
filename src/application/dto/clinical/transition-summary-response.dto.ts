import { ApiProperty } from '@nestjs/swagger';
import { ClinicalSummaryStatus } from '../../../domain/enums/clinical-summary-status.enum';
import { SummaryAuthorKind } from '../../../domain/enums/summary-author-kind.enum';
import { PatientTransitionResponseDto } from '../transition/patient-transition-response.dto';

export class TransitionSummarySectionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  hint: string;
}

export class TransitionSummaryAuthorDto {
  @ApiProperty({ enum: SummaryAuthorKind })
  kind: SummaryAuthorKind;

  @ApiProperty()
  name: string;
}

/**
 * `patientId: string` y `editedBy`/`approvedBy` como nombre resuelto
 * (no id) — así lo declara `ClinicalSummary` en iCode-front (ver
 * domain/entities/clinical-summary.entity.ts de ese repo). `editedById`/
 * `approvedById` no se agregan acá porque, a diferencia de
 * PatientTransitionResponseDto, ningún otro servicio de este backend
 * lee esos ids — no hace falta la variante numérica en paralelo.
 */
export class TransitionSummaryResponseDto {
  @ApiProperty({
    description:
      'String — así lo espera ClinicalSummary.patientId de iCode-front',
  })
  patientId: string;

  @ApiProperty({ enum: ClinicalSummaryStatus })
  status: ClinicalSummaryStatus;

  @ApiProperty({ type: [TransitionSummarySectionDto] })
  sections: TransitionSummarySectionDto[];

  @ApiProperty({ type: [String] })
  pendingChecks: string[];

  @ApiProperty({ type: TransitionSummaryAuthorDto })
  draftedBy: TransitionSummaryAuthorDto;

  @ApiProperty()
  draftedAt: string;

  @ApiProperty({
    nullable: true,
    description:
      'Nombre resuelto de quien editó — null si nadie tocó el borrador',
  })
  editedBy: string | null;

  @ApiProperty({ nullable: true })
  editedAt: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Nombre resuelto de quien firmó',
  })
  approvedBy: string | null;

  @ApiProperty({ nullable: true })
  approvedAt: string | null;
}

/**
 * Lo que devuelven POST/PUT/POST-approval — el documento Y la fila del
 * paciente juntos (ver ClinicalSummaryResult en
 * application/dto/clinical-summary-result.dto.ts de iCode-front): firmar
 * cambia `summaryStatus`/`summaryProgress` en la fila, y la tabla/el
 * riel/los KPIs los necesitan sin recargar la cohorte entera.
 */
export class ClinicalSummaryResultDto {
  @ApiProperty({ type: PatientTransitionResponseDto })
  patient: PatientTransitionResponseDto;

  @ApiProperty({ type: TransitionSummaryResponseDto })
  summary: TransitionSummaryResponseDto;
}
