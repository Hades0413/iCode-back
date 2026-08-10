import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './domain/entities/user.entity';
import { UserSession } from './domain/entities/user-session.entity';
import { AuthService } from './application/services/auth.service';
import { SessionStatsService } from './application/services/session-stats.service';
import { AuthController } from './presentation/controllers/auth.controller';
import { AdminSessionsController } from './presentation/controllers/admin-sessions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserSession])],
  controllers: [AuthController, AdminSessionsController],
  providers: [AuthService, SessionStatsService],
  exports: [AuthService],
})
export class AuthModule {}
