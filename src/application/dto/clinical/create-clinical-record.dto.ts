import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ClinicalRecordType } from '../../../domain/enums/clinical-record-type.enum';
import { SensitivityLevel } from '../../../domain/enums/sensitivity-level.enum';

export class CreateClinicalRecordDto {
  @ApiProperty({ enum: ClinicalRecordType })
  @IsEnum(ClinicalRecordType)
  recordType: ClinicalRecordType;

  @ApiProperty({
    enum: SensitivityLevel,
    description:
      'BASICA (accesible en emergencia sin autorización previa) o SENSIBLE (siempre requiere autorización explícita) — clasificación por ítem, no por paciente',
  })
  @IsEnum(SensitivityLevel)
  sensitivityLevel: SensitivityLevel;

  @ApiProperty({ example: 'Asma bronquial leve' })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({
    required: false,
    description:
      'Detalle específico del tipo (dosis/frecuencia para MEDICACION, severidad para ALERGIA, resultado para EXAMEN...)',
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @ApiProperty({ required: false, example: '2024-03-10' })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  healthFacilityId?: number;
}
