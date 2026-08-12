import { ApiProperty } from '@nestjs/swagger';
import { ClinicalSummaryStatus } from '../../../domain/enums/clinical-summary-status.enum';
import { SummaryAuthorKind } from '../../../domain/enums/summary-author-kind.enum';

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

export class TransitionSummaryResponseDto {
  @ApiProperty()
  patientId: number;

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

  @ApiProperty({ nullable: true })
  editedById: number | null;

  @ApiProperty({ nullable: true })
  editedAt: string | null;

  @ApiProperty({ nullable: true })
  approvedById: number | null;

  @ApiProperty({ nullable: true })
  approvedAt: string | null;
}
