import { ApiProperty } from '@nestjs/swagger';

export class AccessLogResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  patientId: number;

  @ApiProperty()
  accessedByUserId: number;

  @ApiProperty()
  healthFacilityId: number;

  @ApiProperty()
  accessedAt: Date;

  @ApiProperty()
  requestedScope: string;

  @ApiProperty()
  granted: boolean;

  @ApiProperty()
  wasEmergencyOverride: boolean;

  @ApiProperty({ nullable: true })
  denialReason: string | null;
}
