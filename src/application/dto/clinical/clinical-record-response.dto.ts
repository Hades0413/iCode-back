import { ApiProperty } from '@nestjs/swagger';

export class ClinicalRecordResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  patientId: number;

  @ApiProperty()
  recordType: string;

  @ApiProperty()
  sensitivityLevel: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  details: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  occurredAt: string | null;

  @ApiProperty({ nullable: true })
  healthFacilityId: number | null;

  @ApiProperty({ nullable: true })
  recordedByUserId: number | null;
}
