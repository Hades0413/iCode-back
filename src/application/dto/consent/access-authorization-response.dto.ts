import { ApiProperty } from '@nestjs/swagger';

export class AccessAuthorizationResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  patientId: number;

  @ApiProperty()
  healthFacilityId: number;

  @ApiProperty()
  grantedByUserId: number;

  @ApiProperty()
  scope: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  grantedAt: Date;

  @ApiProperty({ nullable: true })
  revokedAt: Date | null;

  @ApiProperty({ nullable: true })
  expiresAt: Date | null;

  @ApiProperty({ nullable: true })
  notes: string | null;
}
