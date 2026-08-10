import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Contra el seed real (src/infrastructure/database/migrations) — password
// de prueba documentada ahí: "Passw0rd1!".
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects protected routes without a session token', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects a wrong password with a generic message', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ userName: 'admin', password: 'wrong' })
      .expect(401)
      .expect((res) => {
        const body = res.body as { message: string };
        expect(body.message).toBe('Usuario o contraseña inválidos');
      });
  });

  it('logs in, reads the profile, logs out, and the token stops working', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ userName: 'admin', password: 'Passw0rd1!' })
      .expect(200);

    const { accessToken } = loginRes.body as { accessToken: string };
    expect(accessToken).toHaveLength(64);

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const profile = meRes.body as { userName: string; permissions: string[] };
    expect(profile.userName).toBe('admin');
    expect(profile.permissions.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it("auditor1's effective permissions come from the CONS role, not AUDIT", async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ userName: 'auditor1', password: 'Passw0rd1!' })
      .expect(200);

    const { accessToken } = loginRes.body as { accessToken: string };
    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const profile = meRes.body as { permissions: string[] };
    expect(profile.permissions.sort()).toEqual(['INV_READ', 'REP_VIEW']);
  });
});
