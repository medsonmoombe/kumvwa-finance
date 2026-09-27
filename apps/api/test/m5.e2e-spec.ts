import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';

type TestServer = Parameters<typeof request>[0];

const DAY = 86_400_000;

describe('M5: bullet loans, credit ladder, overrides (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const password = 'S3cure-Passw0rd!';
  const lenderPhone = `0981${String(stamp).slice(-5)}6`;
  const clientPhone = `0982${String(stamp).slice(-5)}7`;

  let lenderToken = '';
  let clientToken = '';
  let tenantId = '';
  let clientId = '';
  let loan1Id = '';
  let loan1Ref = '';
  let loan2Id = '';
  let loan2Ref = '';
  let loan3Id = '';
  let overrideId = '';

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

  it('setup: verified lender + invited client with completed KYC', async () => {
    await request(server())
      .post('/api/v1/auth/otp/request')
      .send({ phone: lenderPhone, purpose: 'registration' })
      .expect(200);
    const v = await request(server())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: lenderPhone, purpose: 'registration', code: '123456' })
      .expect(200);

    const reg = await request(server())
      .post('/api/v1/auth/register/tenant')
      .send({
        phone: lenderPhone,
        password,
        businessName: 'M5 SACCO',
        businessType: 'sacco',
        otpToken: (v.body as { otpToken: string }).otpToken,
        acceptedTermsVersion: 1,
      })
      .expect(201);
    const regBody = reg.body as { tenantId: string; accessToken: string };
    tenantId = regBody.tenantId;
    lenderToken = regBody.accessToken;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active' },
    });

    const invite = await request(server())
      .post('/api/v1/invites')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({
        clientName: 'M5 Borrower',
        phone: clientPhone,
        email: `m5${stamp}@test.zm`,
      })
      .expect(201);
    const inviteCode = (invite.body as { code: string }).code;

    await request(server())
      .post(`/api/v1/invites/${inviteCode}/complete`)
      .send({ fullName: 'M5 Borrower', password, consent: true })
      .expect(201);

    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ phone: clientPhone, password })
      .expect(200);
    clientToken = (login.body as { accessToken: string }).accessToken;

    await request(server())
      .patch('/api/v1/clients/me/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nrc: `${String(stamp).slice(-6)}/44/9`,
        dateOfBirth: '1988-06-21',
        address: 'Plot 9, Chilenje',
      })
      .expect(200);

    const user = await prisma.user.findUniqueOrThrow({
      where: { phone: `+260${clientPhone.slice(1)}` },
      include: { client: { select: { id: true } } },
    });
    clientId = user.client!.id;
  });

  it('A: platform default ladder rules until a policy is published', async () => {
    // No policy row yet → the platform default is in force, version 0.
    const dflt = await request(server())
      .get('/api/v1/tenants/me/credit-policy')
      .set('Authorization', `Bearer ${lenderToken}`)
      .expect(200);
    const d = dflt.body as {
      policy: {
        tiers: { clearedFrom: number; limitKwacha: number; maxTermMonths: number }[];
      };
      version: number;
    };
    expect(d.version).toBe(0);
    expect(d.policy.tiers[0]).toEqual({
      clearedFrom: 0,
      label: 'First-time borrower',
      limitKwacha: 1000,
      maxTermMonths: 1,
    });

    // The client resolves against the same default (the app banner).
    const fresh = await request(server())
      .get(`/api/v1/credit-limit?lenderId=${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(fresh.body).toMatchObject({
      limitKwacha: 1000,
      tier: 'First-time borrower',
      maxTermMonths: 1,
      blockedReason: null,
      policyVersion: 0,
    });

    // Publishing bumps the version and the ladder takes effect immediately.
    const pub = await request(server())
      .put('/api/v1/tenants/me/credit-policy')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({
        tiers: [
          { clearedFrom: 0, label: 'Fresh', limitKwacha: 1000, maxTermMonths: 3 },
          { clearedFrom: 1, label: 'Trusted', limitKwacha: 2500, maxTermMonths: 6 },
          { clearedFrom: 2, label: 'VIP', limitKwacha: 5000, maxTermMonths: 12 },
        ],
        rules: { maxActiveLoans: 2, blockIfOverdue: true, cooldownDaysAfterDefault: 90 },
      })
      .expect(200);
    expect((pub.body as { version: number }).version).toBe(1);

    const after = await request(server())
      .get('/api/v1/tenants/me/credit-policy')
      .set('Authorization', `Bearer ${lenderToken}`)
      .expect(200);
    const a = after.body as { version: number; policy: { tiers: unknown[] } };
    expect(a.version).toBe(1);
    expect(a.policy.tiers).toHaveLength(3);

    const relim = await request(server())
      .get(`/api/v1/credit-limit?lenderId=${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(relim.body).toMatchObject({
      limitKwacha: 1000,
      tier: 'Fresh',
      maxTermMonths: 3,
      policyVersion: 1,
    });
  });

  it('H: a second application while one is pending is refused (server rule)', async () => {
    // Fresh client, one pending request: this must run BEFORE any active loan
    // exists, or the active-loan block masks the pending-application block.
    const first = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantId,
        amount: 100,
        termCount: 1,
        purpose: 'Hold this one',
      })
      .expect(201);
    const firstId = (first.body as { id: string }).id;

    // The credit banner agrees with the refusal: the lender's limit is
    // blocked with the pending-application reason.
    const blocked = await request(server())
      .get(`/api/v1/credit-limit?lenderId=${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(blocked.body).toMatchObject({
      limitKwacha: 0,
      tier: 'blocked',
      maxTermMonths: 0,
    });
    expect(
      (blocked.body as { blockedReason: string }).blockedReason,
    ).toMatch(/application under review/i);

    const second = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantId,
        amount: 100,
        termCount: 1,
        purpose: 'Should be refused',
      })
      .expect(403);
    expect(
      (second.body as { message: string }).message,
    ).toMatch(/application under review/i);

    // Settle the probe so the suite continues clean.
    await request(server())
      .post(`/api/v1/loan-requests/${firstId}/reject`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ feedback: 'Duplicate — no longer needed' })
      .expect(201);

    const restored = await request(server())
      .get(`/api/v1/credit-limit?lenderId=${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(restored.body).toMatchObject({
      limitKwacha: 1000,
      tier: 'Fresh',
      blockedReason: null,
    });
  });

  it('B: products default to bullet -> one lump installment + sequential loanRef', async () => {
    // No repaymentStructure in the payload: the platform default 'bullet'.
    const product = await request(server())
      .post('/api/v1/loan-products')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({
        name: 'Bullet Market Loan',
        rateBps: 1000,
        minAmount: 20,
        maxAmount: 5000,
        minTerm: 1,
        maxTerm: 12,
        frequency: 'monthly',
      })
      .expect(201);
    const productId = (product.body as { id: string }).id;

    const created = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantId,
        amount: 200,
        termCount: 2,
        purpose: 'Bullet loan, M5 test',
      })
      .expect(201);
    const requestId = (created.body as { id: string }).id;

    const approved = await request(server())
      .post(`/api/v1/loan-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ rateBps: 1000, productId })
      .expect(201);
    loan1Id = (approved.body as { loanId: string }).loanId;

    const mine = await request(server())
      .get('/api/v1/my/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const item = (mine.body as { items: itemShape[] }).items.find(
      (r) => r.id === loan1Id,
    );
    expect(item).toBeDefined();
    expect(item!.repaymentStructure).toBe('bullet');
    // 200 + 10% = 220, held in ONE lump installment at maturity.
    expect(item!.totalDueMinor).toBe('22000');
    expect(item!.installments).toHaveLength(1);
    expect(item!.installments[0]!.amountMinor).toBe('22000');
    expect(item!.loanRef).toMatch(/^LN-\d{4}-\d{5}$/);
    loan1Ref = item!.loanRef!;
  });

  it('C: the pre-climb limit is still enforced (K2000 > K1000)', async () => {
    const res = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantId,
        amount: 2000,
        termCount: 2,
        purpose: 'Too much for a fresh client',
      })
      .expect(403);
    expect((res.body as { message: string }).message).toContain('limit');
  });

  it('D: chunk repayments auto-clear the bullet loan and climb the ladder', async () => {
    // 22000 total: K100 then K120.
    const pay1 = await request(server())
      .post(`/api/v1/loans/${loan1Id}/repayments`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m5-pay-1-${stamp}`)
      .send({ amount: 100, method: 'cash' })
      .expect(201);
    expect(
      (pay1.body as { loan: { outstandingMinor: string } }).loan.outstandingMinor,
    ).toBe('12000');

    const pay2 = await request(server())
      .post(`/api/v1/loans/${loan1Id}/repayments`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m5-pay-2-${stamp}`)
      .send({ amount: 120, method: 'cash' })
      .expect(201);
    expect(
      (pay2.body as { loan: { outstandingMinor: string } }).loan.outstandingMinor,
    ).toBe('0');
    expect(
      (
        await prisma.loan.findUniqueOrThrow({ where: { id: loan1Id } })
      ).status,
    ).toBe('cleared');

    // One fully repaid loan -> the second rung.
    const rose = await request(server())
      .get(`/api/v1/credit-limit?lenderId=${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(rose.body).toMatchObject({
      limitKwacha: 2500,
      tier: 'Trusted',
      maxTermMonths: 6,
    });

    // The earlier-rejected request now fits (2500 / 6-month term).
    const created = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ lenderId: tenantId, amount: 2000, termCount: 4, purpose: 'Restock' })
      .expect(201);
    const requestId = (created.body as { id: string }).id;
    const approved = await request(server())
      .post(`/api/v1/loan-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ rateBps: 1000 })
      .expect(201);
    loan2Id = (approved.body as { loanId: string }).loanId;

    const mine = await request(server())
      .get('/api/v1/my/loans')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const item = (mine.body as { items: itemShape[] }).items.find(
      (r) => r.id === loan2Id,
    );
    expect(item!.loanRef).toMatch(/^LN-\d{4}-\d{5}$/);
    expect(item!.loanRef).not.toBe(loan1Ref); // sequential, unique per lender
    expect(item!.repaymentStructure).toBe('bullet');
    expect(item!.totalDueMinor).toBe('220000'); // 2000 + 10%

    await request(server())
      .post(`/api/v1/loans/${loan2Id}/repayments`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m5-pay-2b-${stamp}`)
      .send({ amount: 2200, method: 'cash' })
      .expect(201);

    // Two fully repaid loans -> the top rung.
    const top = await request(server())
      .get(`/api/v1/credit-limit?lenderId=${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(top.body).toMatchObject({
      limitKwacha: 5000,
      tier: 'VIP',
      maxTermMonths: 12,
    });
    loan2Ref = item!.loanRef!;
  });

  it('E: bullet rollover pays the interest share, extends +1 month, idempotent', async () => {
    const created = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantId,
        amount: 500,
        termCount: 2,
        purpose: 'Roll the bullet loan',
      })
      .expect(201);
    const requestId = (created.body as { id: string }).id;
    const approved = await request(server())
      .post(`/api/v1/loan-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ rateBps: 1000 })
      .expect(201);
    loan3Id = (approved.body as { loanId: string }).loanId;

    const pay = await request(server())
      .post(`/api/v1/loans/${loan3Id}/repayments`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m5-pay-3-${stamp}`)
      .send({ amount: 50, method: 'cash' })
      .expect(201);
    expect(
      (pay.body as { loan: { outstandingMinor: string } }).loan.outstandingMinor,
    ).toBe('50000'); // 55000 - 5000

    // One month's interest share: 50000 * 10% / 2 = 2500.
    const roll = await request(server())
      .post(`/api/v1/loans/${loan3Id}/rollover`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m5-roll-${stamp}`)
      .expect(201);
    const body = roll.body as {
      replayed: boolean;
      rolloverCount: number;
      newTotalDueMinor: string;
      outstandingMinor: string;
    };
    expect(body.replayed).toBe(false);
    expect(body.rolloverCount).toBe(1);
    expect(body.newTotalDueMinor).toBe('57500'); // 55000 + 2500
    // Conservation: paid AND totalDue both grew by 2500.
    expect(body.outstandingMinor).toBe('50000');

    const replay = await request(server())
      .post(`/api/v1/loans/${loan3Id}/rollover`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m5-roll-${stamp}`)
      .expect(201);
    expect((replay.body as { replayed: boolean }).replayed).toBe(true);

    const count = await prisma.repayment.count({
      where: { idempotencyKey: `m5-roll-${stamp}` },
    });
    expect(count).toBe(1);

    // The single installment absorbed the carry cost and moved +1 month.
    const detail = await request(server())
      .get(`/api/v1/loans/${loan3Id}`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .expect(200);
    const loan = detail.body as {
      loanRef: string;
      repaymentStructure: string;
      schedule: { amountMinor: string; dueDate: string }[];
    };
    expect(loan.loanRef).toMatch(/^LN-\d{4}-\d{5}$/);
    expect(loan.loanRef).not.toBe(loan1Ref);
    expect(loan.loanRef).not.toBe(loan2Ref);
    expect(loan.repaymentStructure).toBe('bullet');
    expect(loan.schedule).toHaveLength(1);
    expect(loan.schedule[0]!.amountMinor).toBe('57500');
  });

  it('F: limit override, capped at the policy ceiling, then revoked', async () => {
    // Above the published ceiling (5000) -> refused.
    await request(server())
      .post(`/api/v1/clients/${clientId}/limit-override`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ limitKwacha: 7000, reason: 'Inflated goodwill' })
      .expect(403);

    const grant = await request(server())
      .post(`/api/v1/clients/${clientId}/limit-override`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ limitKwacha: 4500, reason: 'Loyal repeat client' })
      .expect(201);
    overrideId = (grant.body as { overrideId: string }).overrideId;

    const raised = await request(server())
      .get(`/api/v1/credit-limit?lenderId=${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(raised.body).toMatchObject({
      limitKwacha: 4500,
      tier: 'manual override',
    });

    // The override limit is enforced when a request is created.
    const created = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ lenderId: tenantId, amount: 4500, termCount: 2, purpose: 'Gala' })
      .expect(201);
    const galaId = (created.body as { id: string }).id;

    await request(server())
      .delete(`/api/v1/clients/${clientId}/limit-override/${overrideId}`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .expect(200);

    // The Gala request was only ever a limit-enforcement probe — settle it
    // BEFORE re-resolving the credit limit, or the new pending-application
    // rule (one at a time per lender) would block what is otherwise a healthy
    // resume to the VIP rung.
    await request(server())
      .post(`/api/v1/loan-requests/${galaId}/reject`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ feedback: 'Withdrawn — the override was revoked' })
      .expect(201);

    const back = await request(server())
      .get(`/api/v1/credit-limit?lenderId=${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(back.body).toMatchObject({ limitKwacha: 5000, tier: 'VIP' });
  });

  it('G: an overdue loan blocks new applications platform-wide', async () => {
    const inst = await prisma.installment.findFirstOrThrow({
      where: { loanId: loan3Id, seq: 1 },
    });
    await prisma.installment.update({
      where: { id: inst.id },
      data: {
        dueDate: new Date(Date.now() - 40 * DAY),
        status: 'overdue',
      },
    });
    await prisma.loan.update({
      where: { id: loan3Id },
      data: { status: 'overdue' },
    });

    const blocked = await request(server())
      .get(`/api/v1/credit-limit?lenderId=${tenantId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(blocked.body).toMatchObject({
      limitKwacha: 0,
      tier: 'blocked',
      maxTermMonths: 0,
    });
    expect(
      (blocked.body as { blockedReason: string }).blockedReason,
    ).toMatch(/overdue/i);

    const res = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ lenderId: tenantId, amount: 100, termCount: 1, purpose: 'Nope' })
      .expect(403);
    expect((res.body as { message: string }).message).toMatch(/overdue/i);
  });
});

// Shared shape for my/loans items used by the assertions above.
type itemShape = {
  id: string;
  loanRef: string | null;
  repaymentStructure: string;
  totalDueMinor: string;
  installments: { amountMinor: string }[];
};