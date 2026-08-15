import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  userName: string;

  @ApiProperty({ example: '12345' })
  @IsString()
  @MinLength(1)
  password: string;
}
