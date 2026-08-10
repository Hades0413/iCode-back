import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { LoginDto } from '../../application/dto/login.dto';
import { LoginResponseDto } from '../../application/dto/login-response.dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login — devuelve un token de sesión opaco (no es un JWT)',
  })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    return this.authService.login(dto.userName, dto.password, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cierra la sesión actual — el token deja de servir de inmediato',
  })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logout(user.sessionId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado + sus permisos efectivos' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }
}
