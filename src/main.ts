import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HELMET_OPTIONS } from './common/constants/security.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const env = configService.get<string>('app.env', 'development');
  const corsOrigin = configService.get<string>('app.corsOrigin', '*');

  app.use(helmet(HELMET_OPTIONS));
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: true,
  });

  // Correlation id: este middleware corre ANTES que el de pino-http (el
  // middleware de un módulo de Nest recién se registra en app.listen(),
  // no en app.use()), así que acá es donde hay que generarlo — pino-http
  // (ver app.module.ts) está configurado para reusar este mismo req.id en
  // vez de generar uno propio, así el id que ve el cliente es el mismo
  // que aparece en los logs.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    (req as unknown as { id: string }).id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('iCode Back API')
      .setDescription(
        'Fuente de verdad de la API — se genera del código, nunca queda desactualizada. En producción no se expone.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          description:
            'Token de POST /auth/login — no es un JWT, es un token opaco validado contra "UserSession".',
        },
        'bearer',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
}
void bootstrap();
