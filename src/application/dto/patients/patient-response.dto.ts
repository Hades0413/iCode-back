import { ApiProperty } from '@nestjs/swagger';

export class LegalGuardianSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  relationshipType: string;

  @ApiProperty()
  isPrimary: boolean;

  @ApiProperty()
  isActive: boolean;
}

export class PatientResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  documentType: string;

  @ApiProperty()
  documentNumber: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  dateOfBirth: string;

  @ApiProperty({ nullable: true })
  bloodType: string | null;

  @ApiProperty({
    description:
      'true si ya cumplió 18 (calculado desde DateOfBirth, nunca un flag guardado — así nunca queda desactualizado)',
  })
  isAdult: boolean;

  @ApiProperty({
    description:
      'Id de User que hoy puede autorizar accesos sobre este paciente: el propio paciente si isAdult, o su tutor activo si no',
    nullable: true,
  })
  currentTitleholderUserId: number | null;

  @ApiProperty({ type: [LegalGuardianSummaryDto] })
  guardians: LegalGuardianSummaryDto[];
}
