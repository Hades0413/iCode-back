import { ApiProperty } from '@nestjs/swagger';
import { ClinicalRecordResponseDto } from '../clinical/clinical-record-response.dto';

/**
 * Lo que ve un centro de salud al consultar a un paciente — ya filtrado
 * por AccessDecisionService según lo que autorizaron el paciente/tutor
 * (o la excepción de emergencia para BASICA). Nunca incluye ítems por
 * encima del alcance concedido.
 */
export class ClinicalSummaryResponseDto {
  @ApiProperty()
  patientId: number;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ nullable: true })
  bloodType: string | null;

  @ApiProperty({
    description: 'Alcance efectivamente concedido para esta respuesta',
  })
  grantedScope: string;

  @ApiProperty()
  wasEmergencyOverride: boolean;

  @ApiProperty({ type: [ClinicalRecordResponseDto] })
  records: ClinicalRecordResponseDto[];
}
