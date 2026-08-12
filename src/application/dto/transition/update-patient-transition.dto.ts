import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

class HospitalReferralDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  hospital: string;

  @ApiProperty()
  @IsString()
  @Length(1, 150)
  specialty: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  doctor?: string | null;

  @ApiProperty()
  @IsISO8601({ strict: true })
  referredAt: string;
}

class AppointmentDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  hospital: string;

  @ApiProperty()
  @IsString()
  @Length(1, 150)
  specialist: string;

  @ApiProperty()
  @IsISO8601({ strict: true })
  date: string;

  @ApiProperty()
  @IsString()
  @Length(1, 300)
  reason: string;

  @ApiProperty()
  @IsString()
  @Length(1, 150)
  managedBy: string;
}

/**
 * Update parcial — solo lo que venga se toca. No incluye "State": ese lo
 * mueven los servicios de este dominio (ver PatientTransitionService.setState),
 * nunca directamente el cliente.
 */
export class UpdatePatientTransitionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 300)
  primaryDiagnosis?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  specialtyId?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  attendingStaffId?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  district?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  healthPostFacilityId?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  healthPostDistanceKm?: number | null;

  @ApiProperty({ required: false, type: HospitalReferralDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HospitalReferralDto)
  hospitalReferral?: HospitalReferralDto;

  @ApiProperty({ required: false, type: AppointmentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentDto)
  appointment?: AppointmentDto;
}
