import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreatePatientTransitionDto {
  @ApiProperty({ description: 'Id de un "Patient" ya registrado' })
  @IsInt()
  patientId: number;

  @ApiProperty({ example: 'HC-198442' })
  @IsString()
  @Length(1, 30)
  medicalRecordNumber: string;

  @ApiProperty({ required: false, example: 'Leucemia linfoblástica aguda' })
  @IsOptional()
  @IsString()
  @Length(1, 300)
  primaryDiagnosis?: string;

  @ApiProperty({ description: 'Id de un "MedicalSpecialty" del catálogo' })
  @IsInt()
  specialtyId: number;

  @ApiProperty({
    required: false,
    description: 'Id de "HealthFacilityStaff" — el especialista a cargo',
  })
  @IsOptional()
  @IsInt()
  attendingStaffId?: number;

  @ApiProperty({
    required: false,
    description: 'Domicilio del paciente, para asignar la posta más cercana',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  district?: string;
}
