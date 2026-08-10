import {
  Body,
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { SanitizeMiddleware } from './sanitize.middleware';
import { SanitizedQuery } from '../decorators/sanitized-query.decorator';

// Controller descartable, solo para probar sobre un servidor Express real
// (no un mock de req) que: 1) SanitizeMiddleware limpia req.body de
// verdad, y 2) @SanitizedQuery() limpia query params — que es la única
// forma que funciona en Express 5 (ver sanitize.middleware.ts).
@Controller('echo')
class EchoController {
  @Post()
  echoBody(@Body() body: Record<string, string>) {
    return body;
  }

  @Get()
  echoQuery(@SanitizedQuery() query: Record<string, string>) {
    return query;
  }
}

@Module({ controllers: [EchoController] })
class EchoModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SanitizeMiddleware).forRoutes('*');
  }
}

describe('Sanitización (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EchoModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('SanitizeMiddleware strips HTML tags from the body on a real request', () => {
    return request(app.getHttpServer())
      .post('/echo')
      .send({ name: '<script>alert(1)</script>Ana' })
      .expect(201)
      .expect((res) => {
        expect((res.body as { name: string }).name).toBe('Ana');
      });
  });

  it('@SanitizedQuery() strips HTML tags from query params on a real request', () => {
    return request(app.getHttpServer())
      .get('/echo')
      .query({ name: '<script>alert(1)</script>Ana' })
      .expect(200)
      .expect((res) => {
        expect((res.body as { name: string }).name).toBe('Ana');
      });
  });
});
