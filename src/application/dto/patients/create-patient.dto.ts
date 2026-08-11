import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

const DOCUMENT_TYPES = ['DNI', 'CE', 'PASAPORTE'] as const;

export class CreatePatientDto {
  @ApiProperty({ enum: DOCUMENT_TYPES, example: 'DNI' })
  @IsIn(DOCUMENT_TYPES)
  documentType: string;

  @ApiProperty({ example: '70000001', description: 'Documento ficticio' })
  @IsString()
  @Length(1, 20)
  documentNumber: string;

  @ApiProperty({ example: 'Paciente' })
  @IsString()
  @Length(1, 100)
  firstName: string;

  @ApiProperty({ example: 'Ficticio' })
  @IsString()
  @Length(1, 100)
  lastName: string;

  @ApiProperty({ example: '2010-05-20' })
  @IsISO8601({ strict: true })
  dateOfBirth: string;

  @ApiProperty({ required: false, example: 'O+' })
  @IsOptional()
  @IsString()
  @Length(1, 5)
  bloodType?: string;
}
