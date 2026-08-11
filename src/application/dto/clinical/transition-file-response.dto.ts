import { ApiProperty } from '@nestjs/swagger';
import { ClinicalRecordResponseDto } from './clinical-record-response.dto';

/**
 * La "ficha de transición" portable (requisito #6): un JSON estructurado
 * que el paciente puede llevar a cualquier centro de salud. Para el
 * prototipo de hackatón esto reemplaza al PDF ("o similar", según las
 * bases) — queda como fast-follow generar un PDF real con esta misma
 * data si se necesita para la demo final.
 */
export class TransitionFileResponseDto {
  @ApiProperty()
  patientId: number;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  documentType: string;

  @ApiProperty()
  documentNumber: string;

  @ApiProperty()
  dateOfBirth: string;

  @ApiProperty({ nullable: true })
  bloodType: string | null;

  @ApiProperty()
  isAdult: boolean;

  @ApiProperty({ type: [ClinicalRecordResponseDto] })
  diagnoses: ClinicalRecordResponseDto[];

  @ApiProperty({ type: [ClinicalRecordResponseDto] })
  medications: ClinicalRecordResponseDto[];

  @ApiProperty({ type: [ClinicalRecordResponseDto] })
  allergies: ClinicalRecordResponseDto[];

  @ApiProperty({ type: [ClinicalRecordResponseDto] })
  surgeries: ClinicalRecordResponseDto[];

  @ApiProperty({ type: [ClinicalRecordResponseDto] })
  exams: ClinicalRecordResponseDto[];

  @ApiProperty({
    description: 'Cuándo se generó esta ficha — no es un documento vivo',
  })
  generatedAt: Date;
}
