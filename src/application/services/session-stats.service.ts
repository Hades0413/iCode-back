import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { geolocateIp } from '../../common/utils/geolocation.util';
import { OnlineUsersResponseDto } from '../dto/online-user.dto';

interface OnlineSessionRow {
  UserId: number;
  UserName: string;
  FirstName: string;
  LastName: string;
  IpAddress: string | null;
  UserAgent: string | null;
  LastActivityAt: Date;
}

@Injectable()
export class SessionStatsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /**
   * "En línea" = actividad dentro de ONLINE_THRESHOLD_MINUTES, no
   * "sesión activa" — con la expiración deslizante de
   * SESSION_IDLE_TTL_DAYS, una sesión sigue siendo válida semanas después
   * de la última vez que alguien la usó de verdad.
   */
  async getOnlineUsers(): Promise<OnlineUsersResponseDto> {
    const thresholdMinutes = this.config.get<number>(
      'app.onlineThresholdMinutes',
      15,
    );

    const rows = await this.dataSource.query<OnlineSessionRow[]>(
      `
      SELECT
        u."Id" AS "UserId",
        u."UserName",
        u."FirstName",
        u."LastName",
        s."IpAddress",
        s."UserAgent",
        s."LastActivityAt"
      FROM "UserSession" s
      JOIN "User" u ON u."Id" = s."UserId"
      WHERE s."RevokedAt" IS NULL
        AND s."DeletedAt" IS NULL
        AND s."ExpiresAt" > now()
        AND s."LastActivityAt" > now() - make_interval(mins => $1::int)
        AND u."State" = true
        AND u."DeletedAt" IS NULL
      ORDER BY s."LastActivityAt" DESC
      `,
      [thresholdMinutes],
    );

    const sessions = rows.map((row) => ({
      userId: row.UserId,
      userName: row.UserName,
      firstName: row.FirstName,
      lastName: row.LastName,
      ipAddress: row.IpAddress,
      userAgent: row.UserAgent,
      lastActivityAt: row.LastActivityAt,
      location: geolocateIp(row.IpAddress),
    }));

    return {
      onlineUserCount: new Set(rows.map((row) => row.UserId)).size,
      onlineSessionCount: rows.length,
      sessions,
    };
  }
}
