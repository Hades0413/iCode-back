import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Token opaco — mandalo en "Authorization: Bearer <token>"',
  })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ description: 'Cuándo expira la sesión si no se cierra antes' })
  expiresAt: Date;
}
