import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';

type TestServer = Parameters<typeof request>[0];

describe('Loan requests lifecycle (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const password = 'S3cure-Passw0rd!';
  const lenderAPhone = `0976${String(stamp).slice(-5)}1`; // 10 digits — ZM valid
  const lenderBPhone = `0976${String(stamp).slice(-5)}2`;
  const clientPhone = `0977${String(stamp).slice(-5)}3`;
  const nrc = `${String(stamp).slice(-6)}/99/1`; // unique per run, 6/2/1

  let clientToken = '';
  let tokenA = '';
  let tokenB = '';
  let tenantAId = '';
  let tenantBId = '';
  let requestId = '';

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
    await prisma.$disconnect();
  });

  const server = (): TestServer => app.getHttpServer() as TestServer;

  async function registerTenant(phone: string) {
    // Our auth controller returns 200 for the @HttpCode(200) routes.
    await request(server())
      .post('/api/v1/auth/otp/request')
      .send({ phone, purpose: 'registration' })
      .expect(200);
    const v = await request(server())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, purpose: 'registration', code: '123456' })
      .expect(200);
    return request(server())
      .post('/api/v1/auth/register/tenant')
      .send({
        phone,
        password,
        businessName: `L${phone.slice(-3)}`,
        businessType: 'sacco',
        otpToken: (v.body as { otpToken: string }).otpToken,
        acceptedTermsVersion: 1,
      })
      .expect(201);
  }

  it('setup: two verified lenders + one shared (deduped) client', async () => {
    const a = await registerTenant(lenderAPhone);
    const b = await registerTenant(lenderBPhone);
    const aBody = a.body as { tenantId: string; accessToken: string };
    const bBody = b.body as { tenantId: string; accessToken: string };
    tenantAId = aBody.tenantId;
    tenantBId = bBody.tenantId;
    tokenA = aBody.accessToken;
    tokenB = bBody.accessToken;

    // Tenants start pending_verification (BOZ gate) — activate them here.
    await prisma.tenant.update({
      where: { id: tenantAId },
      data: { status: 'active' },
    });
    await prisma.tenant.update({
      where: { id: tenantBId },
      data: { status: 'active' },
    });

    for (const [i, token] of [tokenA, tokenB].entries()) {
      const invite = await request(server())
        .post('/api/v1/invites')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientName: 'Request Tester',
          phone: clientPhone,
          email: `request${stamp}${i}@test.zm`,
        })
        .expect(201);
      const { code: inviteCode } = invite.body as { code: string };

      // The public lookup must resolve before the account exists.
      await request(server()).get(`/api/v1/invites/${inviteCode}`).expect(200);

      if (i === 0) {
        // First invite mints the ACCOUNT only (name + password). KYC is
        // completed post-login via the profile wizard.
        await request(server())
          .post(`/api/v1/invites/${inviteCode}/complete`)
          .send({ fullName: 'Request Tester', password, consent: true })
          .expect(201);
      } else {
        // Second lender: the phone already has an account → the invite just
        // links the existing client to this tenant (dedupe, no 2nd account).
        await request(server())
          .post(`/api/v1/invites/${inviteCode}/complete`)
          .send({ fullName: 'Request Tester', password, consent: true })
          .expect(201);
      }
    }

    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ phone: clientPhone, password })
      .expect(200);
    const loginBody = login.body as {
      accessToken: string;
      user: { profileComplete: boolean; profilePercent: number };
    };
    clientToken = loginBody.accessToken;
    // Account minted but KYC outstanding → the app must gate on this.
    expect(loginBody.user.profileComplete).toBe(false);
    expect(loginBody.user.profilePercent).toBe(40);

    // Complete the profile through the post-login wizard endpoint.
    const profiled = await request(server())
      .patch('/api/v1/clients/me/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nrc,
        dateOfBirth: '1994-01-20',
        address: 'Plot 5, Kalingalinga',
      })
      .expect(200);
    expect(
      (profiled.body as { profileComplete: boolean }).profileComplete,
    ).toBe(true);

    const lenders = await request(server())
      .get('/api/v1/clients/me/lenders')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect((lenders.body as { items: unknown[] }).items).toHaveLength(2);
  });

  it('rejects a request above the server-computed credit limit', async () => {
    const res = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantAId,
        amount: 5000,
        termCount: 3,
        purpose: 'Beyond no-history limit',
      })
      .expect(403);
    expect((res.body as { message: string }).message).toContain('limit');
  });

  it('rejects an unlinked lender target', async () => {
    const c = await registerTenant(`0978${String(stamp).slice(-5)}4`);
    await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: (c.body as { tenantId: string }).tenantId,
        amount: 500,
        termCount: 2,
        purpose: 'Not linked',
      })
      .expect(404);
  });

  it('creates a valid request and notifies the lender', async () => {
    const created = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantAId,
        amount: 800,
        termCount: 2,
        purpose: 'Stock up on mealie meal',
      })
      .expect(201);
    const body = created.body as { id: string; status: string };
    requestId = body.id;
    expect(body.status).toBe('pending');

    const feed = await request(server())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const items = (feed.body as { items: { type: string }[] }).items;
    expect(items.some((n) => n.type === 'loan_request')).toBe(true);
  });

  it('lender isolation: B sees an empty inbox', async () => {
    const inbox = await request(server())
      .get('/api/v1/loan-requests/inbox')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect((inbox.body as { items: unknown[] }).items).toHaveLength(0);
  });

  it('A approves -> loan exists, client notified, request linked', async () => {
    const approved = await request(server())
      .post(`/api/v1/loan-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ rateBps: 1500 })
      .expect(201);
    const loanId = (approved.body as { loanId: string }).loanId;
    expect(loanId).toBeDefined();

    const mine = await request(server())
      .get('/api/v1/my/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const items = (
      mine.body as {
        items: { totalDueMinor: string; installments: unknown[] }[];
      }
    ).items;
    expect(items).toHaveLength(1);
    expect(items[0]!.totalDueMinor).toBe('92000'); // 800 + 15% = K920
    expect(items[0]!.installments).toHaveLength(2);

    const detail = await request(server())
      .get(`/api/v1/loan-requests/${requestId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect((detail.body as { status: string }).status).toBe('approved');
    expect((detail.body as { loanId: string }).loanId).toBe(loanId);

    const feed = await request(server())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const notifs = (feed.body as { items: { type: string }[] }).items;
    expect(notifs.some((n) => n.type === 'request_approved')).toBe(true);
  });

  it('double-approve conflicts', async () => {
    await request(server())
      .post(`/api/v1/loan-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ rateBps: 1500 })
      .expect(409);
  });

  it('reject flow: second request declined with mandatory feedback', async () => {
    // Clear the first loan directly so the internal score (and limit) rises.
    const loan = await prisma.loan.findFirstOrThrow({
      where: { tenantId: tenantAId },
    });
    await prisma.repayment.create({
      data: {
        loanId: loan.id,
        tenantId: tenantAId,
        amount: loan.totalDue,
        method: 'cash',
        idempotencyKey: `e2e-b4-clear-${stamp}`,
        recordedBy: 'e2e',
      },
    });
    await prisma.installment.updateMany({
      where: { loanId: loan.id },
      data: { paidAmount: 0n, status: 'paid', paidAt: new Date() },
    });
    // Set each installment's paidAmount to its own amount (no field refs).
    const installments = await prisma.installment.findMany({
      where: { loanId: loan.id },
    });
    for (const inst of installments) {
      await prisma.installment.update({
        where: { id: inst.id },
        data: { paidAmount: inst.amount },
      });
    }
    await prisma.loan.update({
      where: { id: loan.id },
      data: { paidAmount: loan.totalDue, status: 'cleared' },
    });

    const r2 = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantAId,
        amount: 900,
        termCount: 2,
        purpose: 'Emergency school costs',
      })
      .expect(201);
    const r2Id = (r2.body as { id: string }).id;

    // Feedback too short -> validation error
    await request(server())
      .post(`/api/v1/loan-requests/${r2Id}/reject`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ feedback: 'no' })
      .expect(400);

    await request(server())
      .post(`/api/v1/loan-requests/${r2Id}/reject`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        feedback: 'Amount exceeds our current policy limit for new borrowers.',
      })
      .expect(201);

    const feed = await request(server())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const notifs = (feed.body as { items: { type: string }[] }).items;
    expect(notifs.some((n) => n.type === 'request_rejected')).toBe(true);
  });

  it('read-all clears the unread count', async () => {
    await request(server())
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const feed = await request(server())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect((feed.body as { unread: number }).unread).toBe(0);
  });

  it('device registration upserts and scopes to the caller', async () => {
    const token = `fcm-token-${stamp}-abcdefghijklmnop`;
    await request(server())
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ token, platform: 'android' })
      .expect(201);
    // Same token, other user -> ownership moves.
    await request(server())
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ token, platform: 'android' })
      .expect(201);

    const row = await prisma.devicePushToken.findUniqueOrThrow({
      where: { token },
    });
    const owner = await prisma.user.findUniqueOrThrow({
      where: { phone: `+260${lenderAPhone.slice(1)}` },
    });
    expect(row.userId).toBe(owner.id);
  });
});
