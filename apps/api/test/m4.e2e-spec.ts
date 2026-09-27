import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';

type TestServer = Parameters<typeof request>[0];

const DAY = 86_400_000;

describe('M4: fees, weekly cycles, rollover, PAR (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const password = 'S3cure-Passw0rd!';
  const lenderPhone = `0974${String(stamp).slice(-5)}1`;
  const clientPhone = `0975${String(stamp).slice(-5)}2`;

  let lenderToken = '';
  let clientToken = '';
  let tenantId = '';
  let weeklyLoanId = '';
  let monthlyLoanId = '';

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

  it('setup: verified lender + invited client', async () => {
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
        businessName: 'M4 SACCO',
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

    // M5: products default to 'bullet' and the default policy caps a fresh
    // client at 1 month / K1000 — this suite spans an 8-week schedule and two
    // concurrent loans, so publish a permissive ladder for the tenant.
    await request(server())
      .put('/api/v1/tenants/me/credit-policy')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({
        tiers: [
          {
            clearedFrom: 0,
            label: 'M4 Fresh',
            limitKwacha: 5000,
            maxTermMonths: 12,
          },
          {
            clearedFrom: 1,
            label: 'M4 Proven',
            limitKwacha: 10000,
            maxTermMonths: 12,
          },
        ],
        rules: { maxActiveLoans: 3, blockIfOverdue: true, cooldownDaysAfterDefault: 90 },
      })
      .expect(200);

    const invite = await request(server())
      .post('/api/v1/invites')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({
        clientName: 'M4 Borrower',
        phone: clientPhone,
        email: `m4${stamp}@test.zm`,
      })
      .expect(201);
    const inviteCode = (invite.body as { code: string }).code;

    await request(server())
      .post(`/api/v1/invites/${inviteCode}/complete`)
      .send({ fullName: 'M4 Borrower', password, consent: true })
      .expect(201);

    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ phone: clientPhone, password })
      .expect(200);
    const loginBody = login.body as { accessToken: string };
    clientToken = loginBody.accessToken;

    await request(server())
      .patch('/api/v1/clients/me/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nrc: `${String(stamp).slice(-6)}/88/9`,
        dateOfBirth: '1992-05-15',
        address: 'Plot 3, Matero',
      })
      .expect(200);
  });

  it('weekly loan with a 5% deductible fee: fee in total, net disbursement, 7-day spacing', async () => {
    const product = await request(server())
      .post('/api/v1/loan-products')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({
        name: 'Weekly Market Loan',
        rateBps: 1000,
        minAmount: 100,
        maxAmount: 5000,
        minTerm: 1,
        maxTerm: 12,
        frequency: 'weekly',
        repaymentStructure: 'installments',
        originationFeeBps: 500,
        feeTreatment: 'deduct',
        penaltyBpsPerDay: 0,
        penaltyCapBps: 2000,
      })
      .expect(201);
    const productId = (product.body as { id: string }).id;

    const created = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantId,
        amount: 1000,
        termCount: 8,
        purpose: 'Weekly market stock, M4 test',
      })
      .expect(201);
    const requestId = (created.body as { id: string }).id;

    const approved = await request(server())
      .post(`/api/v1/loan-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ rateBps: 1000, productId })
      .expect(201);
    weeklyLoanId = (approved.body as { loanId: string }).loanId;

    const detail = await request(server())
      .get(`/api/v1/loans/${weeklyLoanId}`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .expect(200);
    const loan = detail.body as {
      frequency: string;
      totalDueMinor: string;
      disbursementMinor: string;
      feeMinor: string;
      schedule: {
        seq: number;
        dueDate: string;
        amountMinor: string;
        status: string;
      }[];
    };

    expect(loan.frequency).toBe('weekly');
    // principal 100000 + interest 10% (10000) + fee 5% (5000) = 115000
    expect(loan.totalDueMinor).toBe('115000');
    expect(loan.feeMinor).toBe('5000');
    expect(loan.disbursementMinor).toBe('95000'); // deduct: net of the fee
    expect(loan.schedule).toHaveLength(8);

    // 7-day installment spacing (Saturday-to-Saturday style week math).
    const diffs = loan.schedule.slice(1).map((s, i) => {
      return (
        new Date(loan.schedule[i]!.dueDate).getTime() ||
        new Date(s.dueDate).getTime()
      );
    });
    for (let i = 1; i < loan.schedule.length; i++) {
      expect(
        new Date(loan.schedule[i]!.dueDate).getTime() -
          new Date(loan.schedule[i - 1]!.dueDate).getTime(),
      ).toBe(7 * DAY);
    }
    void diffs;

    const sum = loan.schedule.reduce((a, s) => a + BigInt(s.amountMinor), 0n);
    expect(sum).toBe(BigInt(loan.totalDueMinor));
  });

  it('partial payment then rollover: shifts unpaid, appends share, outstanding conserved', async () => {
    // A flat monthly product so the rollover loan has no fee (approve() pins the
    // tenant's first active product when productId is omitted — that would be
    // the weekly 5%-fee product above).
    const flatProduct = await request(server())
      .post('/api/v1/loan-products')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({
        name: 'Flat Monthly',
        rateBps: 1000,
        minAmount: 100,
        maxAmount: 5000,
        minTerm: 1,
        maxTerm: 12,
        repaymentStructure: 'installments',
        originationFeeBps: 0,
      })
      .expect(201);

    const created = await request(server())
      .post('/api/v1/loan-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        lenderId: tenantId,
        amount: 1000,
        termCount: 3,
        purpose: 'Rollover money-path test',
      })
      .expect(201);
    const requestId = (created.body as { id: string }).id;

    const approved = await request(server())
      .post(`/api/v1/loan-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({
        rateBps: 1000,
        productId: (flatProduct.body as { id: string }).id,
      })
      .expect(201);
    monthlyLoanId = (approved.body as { loanId: string }).loanId;

    // K10 against installment #1 (half of one ~K36.67 installment).
    await request(server())
      .post(`/api/v1/loans/${monthlyLoanId}/repayments`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m4-pay-${stamp}`)
      .send({ amount: 10, method: 'cash' })
      .expect(201);

    // Interest share of ONE installment at 10%/3 terms = K33.33 (floor).
    const roll = await request(server())
      .post(`/api/v1/loans/${monthlyLoanId}/rollover`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m4-roll-${stamp}`)
      .expect(201);
    const body = roll.body as {
      replayed: boolean;
      rolloverCount: number;
      newTotalDueMinor: string;
      outstandingMinor: string;
    };
    expect(body.replayed).toBe(false);
    expect(body.rolloverCount).toBe(1);
    expect(body.newTotalDueMinor).toBe('113333'); // 110000 + 3333
    // conservation: K10 = 1000 ngwee already paid, so outstanding stays
    // 110000 - 1000 = 109000 (paid AND totalDue both grew by 3333).
    expect(body.outstandingMinor).toBe('109000'); // 113333 - 1000 - 3333

    const detail = await request(server())
      .get(`/api/v1/loans/${monthlyLoanId}`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .expect(200);
    const loan = detail.body as {
      totalDueMinor: string;
      paidAmountMinor: string;
      outstandingMinor: string;
      rolloverCount: number;
      schedule: {
        seq: number;
        status: string;
        amountMinor: string;
        paidAmountMinor: string;
      }[];
    };
    expect(loan.schedule).toHaveLength(4); // 3 shifted + 1 appended
    expect(loan.rolloverCount).toBe(1);
    // Conservation holds on the detail view too: 113333 - (1000 paid + 3333
    // rollover share) = 109000 — outstanding is unchanged by the rollover.
    expect(loan.outstandingMinor).toBe('109000');

    // The appended interest-only installment is the last one, and it is born
    // PAID: it documents the fee this rollover just collected. Created unpaid
    // it booked the fee twice — once as collected, once as debt — which let a
    // settled loan read "cleared" with an installment still showing as due.
    const appended = loan.schedule.at(-1)!;
    expect(appended.seq).toBe(4);
    expect(appended.paidAmountMinor).toBe(appended.amountMinor);

    // The invariant that catches this class of bug: BOTH ledgers must agree
    // after any money mutation. Σ amounts === totalDue was already checked;
    // Σ paid === the loan's paid ledger is the side that drifted.
    const instAmounts = loan.schedule.reduce(
      (a, s) => a + BigInt(s.amountMinor),
      0n,
    );
    expect(instAmounts).toBe(BigInt(loan.totalDueMinor));
    const instPaid = loan.schedule.reduce(
      (a, s) => a + BigInt(s.paidAmountMinor),
      0n,
    );
    expect(instPaid).toBe(BigInt(loan.paidAmountMinor));

    // Rollover recorded as a mobile-money repayment row.
    const reps = await request(server())
      .get(`/api/v1/loans/${monthlyLoanId}/repayments`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .expect(200);
    const rows = (reps.body as { items: { amountMinor: string; method: string }[] }).items;
    const rollRow = rows.find((r) => r.method === 'mobile_money');
    expect(rollRow?.amountMinor).toBe('3333');
  });

  it('idempotent rollover: replay returns replayed and no double-crediting', async () => {
    const replay = await request(server())
      .post(`/api/v1/loans/${monthlyLoanId}/rollover`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m4-roll-${stamp}`)
      .expect(201);
    const body = replay.body as { replayed: boolean; rolloverCount: number };
    expect(body.replayed).toBe(true);
    expect(body.rolloverCount).toBe(1);

    const count = await prisma.repayment.count({
      where: { idempotencyKey: `m4-roll-${stamp}` },
    });
    expect(count).toBe(1);
  });

  it('rollover cap: ROLLOVER_MAX=2 blocks a third consecutive carry-over', async () => {
    await request(server())
      .post(`/api/v1/loans/${monthlyLoanId}/rollover`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m4-roll-2-${stamp}`)
      .expect(201);

    const blocked = await request(server())
      .post(`/api/v1/loans/${monthlyLoanId}/rollover`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .set('Idempotency-Key', `m4-roll-3-${stamp}`)
      .expect(400);
    expect(
      (blocked.body as { message: string }).message,
    ).toMatch(/limit/i);
  });

  it('PAR aging: a 40-day-late installment lands in PAR-30', async () => {
    // Force the weekly loan's first installment 40 days in the past (still
    // unpaid) — >30 days late, so it should land in the PAR-30 share.
    const first = await prisma.installment.findFirstOrThrow({
      where: { loanId: weeklyLoanId, seq: 1 },
    });
    await prisma.installment.update({
      where: { id: first.id },
      data: {
        dueDate: new Date(Date.now() - 40 * DAY),
        status: 'overdue',
      },
    });

    const res = await request(server())
      .get('/api/v1/reports/par')
      .set('Authorization', `Bearer ${lenderToken}`)
      .expect(200);
    const par = res.body as {
      totalOutstandingMinor: string;
      par30Minor: string;
      par30Pct: number;
      buckets: {
        current: string;
        d1_30: string;
        d31_60: string;
        d61_90: string;
        d90p: string;
      };
    };

    const outstandingText = par.totalOutstandingMinor;
    expect(BigInt(outstandingText)).toBeGreaterThan(0n);

    // The weekly loan is the only late one — its outstanding sits 31-60 days.
    const weekly = await prisma.loan.findUniqueOrThrow({
      where: { id: weeklyLoanId },
      include: { installments: true },
    });
    const expectedOutstanding = (weekly.totalDue - weekly.paidAmount).toString();
    expect(par.buckets.d31_60).toBe(expectedOutstanding);
    expect(par.par30Minor).toBe(expectedOutstanding);
    expect(par.par30Pct).toBeGreaterThan(0);
  });
});