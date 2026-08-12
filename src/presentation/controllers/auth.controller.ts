import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../application/services/auth.service';
import { LoginDto } from '../../application/dto/login.dto';
import { LoginResponseDto } from '../../application/dto/login-response.dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { SESSION_COOKIE_NAME } from '../../common/constants/security.constants';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Login — token opaco en el body (para Swagger/Postman/móvil) Y en una cookie httpOnly (para iCode-front, ver SESSION_COOKIE_NAME)',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(dto.userName, dto.password, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.setSessionCookie(res, result.accessToken, result.expiresAt);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cierra la sesión actual — el token deja de servir de inmediato',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.sessionId);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado + sus permisos efectivos' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  /**
   * `secure` exige HTTPS — en dev (http://localhost) el navegador
   * descartaría la cookie si la mandáramos con esto en true, así que sale
   * de `app.env`, igual que el resto del proyecto decide dev vs prod (ver
   * main.ts). `sameSite: 'none'` en producción porque front y back suelen
   * vivir en dominios distintos ahí (y "none" exige "secure"); en dev,
   * "lax" alcanza porque los dos corren en localhost (mismo "site" aunque
   * cambie el puerto).
   */
  private setSessionCookie(
    res: Response,
    token: string,
    expiresAt: Date,
  ): void {
    const isProd = this.config.get<string>('app.env') === 'production';
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      expires: expiresAt,
    });
  }
}
