import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth.module';
import { SanitizeMiddleware } from './common/middlewares/sanitize.middleware';
import { EncryptResponseInterceptor } from './common/interceptors/encrypt-response.interceptor';
import appConfig from './infrastructure/config/app.config';
import databaseConfig from './infrastructure/config/database.config';
import { resolveEnvFilePath } from './infrastructure/config/env-file';
import { envValidationSchema } from './infrastructure/config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthController } from './presentation/controllers/health.controller';
import { AllExceptionsFilter } from './presentation/filters/all-exceptions.filter';
import { SessionAuthGuard } from './presentation/guards/session-auth.guard';
import { PermissionGuard } from './presentation/guards/permission.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePath(),
      load: [appConfig, databaseConfig],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('app.logLevel', 'info'),
          // El middleware de main.ts ya le puso req.id antes de que esto
          // corra — reusarlo evita que el id que ve el cliente
          // (X-Request-Id) sea distinto del que queda en los logs.
          genReqId: (req: IncomingMessage) =>
            (req as unknown as { id?: string }).id ??
            (req.headers['x-request-id'] as string | undefined) ??
            randomUUID(),
          // No loguear credenciales aunque alguien las mande en headers.
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          transport:
            config.get<string>('app.env') !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('app.throttleTtlMs', 60000),
            limit: config.get<number>('app.throttleLimit', 100),
          },
        ],
      }),
    }),
    DatabaseModule,
    TerminusModule,
    AuthModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Orden importa: la sesión tiene que resolverse (y poner req.user)
    // antes de que PermissionGuard pueda revisar sus permisos.
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: EncryptResponseInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SanitizeMiddleware).forRoutes('*');
  }
}
