import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

type TestServer = Parameters<typeof request>[0];

interface OtpRequestRes {
  requestId: string;
  expiresInMin: number;
  devCode: string;
}
interface OtpVerifyRes {
  otpToken: string;
}
interface RegisterRes {
  user: { userId: string; role: string };
  tenantId: string;
  tenantStatus: string;
  accessToken: string;
  refreshToken: string;
}
interface LoginRes {
  user: { userId: string; displayName: string; phone: string; role: string };
  accessToken: string;
  refreshToken: string;
}
interface RefreshRes {
  user: { userId: string };
  accessToken: string;
  refreshToken: string;
}
interface MeRes {
  userId: string;
  displayName: string;
  phone: string;
  role: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const phone = `097${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const password = 'S3cure-Passw0rd!';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = (): TestServer => app.getHttpServer() as TestServer;

  it('registers a tenant through the OTP gate', async () => {
    const otpReq = await request(server())
      .post('/api/v1/auth/otp/request')
      .send({ phone, purpose: 'registration' })
      .expect(200);
    const otp = otpReq.body as OtpRequestRes;
    expect(otp.devCode).toBe('123456'); // dev mode hardcoded OTP

    const verified = await request(server())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, purpose: 'registration', code: otp.devCode })
      .expect(200);
    const v = verified.body as OtpVerifyRes;
    expect(v.otpToken).toBeDefined();

    const reg = await request(server())
      .post('/api/v1/auth/register/tenant')
      .send({
        phone,
        password,
        businessName: 'Test SACCO',
        businessType: 'sacco',
        otpToken: v.otpToken,
        acceptedTermsVersion: 1,
      })
      .expect(201);
    const r = reg.body as RegisterRes;
    expect(r.user.role).toBe('tenant_owner');
    expect(r.tenantStatus).toBe('pending_verification');
    expect(r.accessToken).toBeDefined();
  });

  it('rejects a wrong OTP code', async () => {
    const wrongPhone = `096${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    await request(server())
      .post('/api/v1/auth/otp/request')
      .send({ phone: wrongPhone, purpose: 'registration' })
      .expect(200);
    await request(server())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: wrongPhone, purpose: 'registration', code: '000000' })
      .expect(400);
  });

  it('logs in and rotates refresh tokens', async () => {
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ phone, password })
      .expect(200);
    const l = login.body as LoginRes;

    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${l.accessToken}`)
      .expect(200);
    expect((me.body as MeRes).userId).toBe(l.user.userId);

    const rotated = await request(server())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: l.refreshToken })
      .expect(200);
    const r = rotated.body as RefreshRes;
    expect(r.refreshToken).not.toBe(l.refreshToken);

    // REUSE: replaying the old token must revoke the whole family
    await request(server())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: l.refreshToken })
      .expect(401);

    // Even the NEW token is dead now
    await request(server())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: r.refreshToken })
      .expect(401);
  });

  it('rejects bad credentials with a generic message', async () => {
    const res = await request(server())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'wrong-password' })
      .expect(401);
    expect((res.body as { message: string }).message).toBe(
      'Invalid phone number or password',
    );
  });
});
