import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

type TestServer = Parameters<typeof request>[0];
type HealthBody = { status: string; checks: Record<string, string> };

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health → 200 ok', async () => {
    const res = await request(app.getHttpServer() as TestServer)
      .get('/api/v1/health')
      .expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/health/ready → 200 with passing checks', async () => {
    const res = await request(app.getHttpServer() as TestServer)
      .get('/api/v1/health/ready')
      .expect(200);
    const body = res.body as HealthBody;
    expect(body.checks['db']).toBe('ok');
    expect(body.checks['redis']).toBe('ok');
  });
});
