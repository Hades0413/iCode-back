import { ApiProperty } from '@nestjs/swagger';

export class GeoLocationDto {
  @ApiProperty({ nullable: true, example: 'PE' })
  country: string | null;

  @ApiProperty({ nullable: true, example: 'LIM' })
  region: string | null;

  @ApiProperty({ nullable: true, example: 'Lima' })
  city: string | null;

  @ApiProperty({ nullable: true, example: -12.0464 })
  latitude: number | null;

  @ApiProperty({ nullable: true, example: -77.0428 })
  longitude: number | null;
}

export class OnlineUserDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ nullable: true })
  ipAddress: string | null;

  @ApiProperty({ nullable: true })
  userAgent: string | null;

  @ApiProperty()
  lastActivityAt: Date;

  @ApiProperty({
    type: GeoLocationDto,
    nullable: true,
    description:
      'Aproximado por IP, no exacto. null si es una IP privada/local (típico en dev) o no se pudo geolocalizar.',
  })
  location: GeoLocationDto | null;
}

export class OnlineUsersResponseDto {
  @ApiProperty({
    description:
      'Usuarios distintos en línea (uno puede tener varias sesiones/dispositivos)',
  })
  onlineUserCount: number;

  @ApiProperty({
    description:
      'Total de sesiones activas contadas (puede ser mayor a onlineUserCount)',
  })
  onlineSessionCount: number;

  @ApiProperty({ type: [OnlineUserDto] })
  sessions: OnlineUserDto[];
}
