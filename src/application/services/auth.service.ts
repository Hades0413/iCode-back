import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { UserSession } from '../../domain/entities/user-session.entity';
import { verifyPassword } from '../../common/utils/password-hashing.util';
import {
  generateSessionToken,
  hashSessionToken,
} from '../../common/utils/session-token.util';
import { LoginResponseDto } from '../dto/login-response.dto';

export interface LoginMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface UserProfile {
  id: number;
  userName: string;
  email: string | null;
  firstName: string;
  lastName: string;
  permissions: string[];
}

interface PermissionRow {
  PermissionCode: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async login(
    userName: string,
    password: string,
    meta: LoginMetadata,
  ): Promise<LoginResponseDto> {
    const user = await this.userRepository.findOne({ where: { userName } });

    // Mismo mensaje siempre, exista o no el usuario — no des pistas para
    // enumerar cuentas (OWASP).
    const invalidCredentials = () =>
      new UnauthorizedException('Usuario o contraseña inválidos');

    if (!user || !user.state) {
      throw invalidCredentials();
    }

    const passwordOk = await verifyPassword(
      password,
      user.passwordHash,
      user.passwordSalt,
    );
    if (!passwordOk) {
      throw invalidCredentials();
    }

    const token = generateSessionToken();
    const idleTtlDays = this.config.get<number>('app.sessionIdleTtlDays', 30);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + idleTtlDays * 24 * 60 * 60 * 1000,
    );

    const session = this.sessionRepository.create({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      createdAt: now,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    });
    await this.sessionRepository.save(session);

    await this.userRepository.update(user.id, { lastLoginAt: now });

    return { accessToken: token, tokenType: 'Bearer', expiresAt };
  }

  /**
   * sessionId sale de SessionAuthGuard (ya validó el token), nunca de un
   * parámetro que mande el cliente — así no hay forma de pedirle a la API
   * que cierre la sesión de otro usuario.
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, { revokedAt: new Date() });
  }

  async getProfile(userId: number): Promise<UserProfile> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const permissions = await this.dataSource.query<PermissionRow[]>(
      `SELECT "PermissionCode" FROM "UserPermission" WHERE "UserId" = $1 ORDER BY "PermissionCode"`,
      [userId],
    );

    return {
      id: user.id,
      userName: user.userName,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      permissions: permissions.map((row) => row.PermissionCode),
    };
  }
}
