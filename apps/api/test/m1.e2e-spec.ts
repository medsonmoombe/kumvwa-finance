import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';

type TestServer = Parameters<typeof request>[0];

describe('M1: profiles, branding, terms, email (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const password = 'S3cure-Passw0rd!';
  const lenderPhone = `0971${String(stamp).slice(-5)}1`;
  const clientPhone = `0972${String(stamp).slice(-5)}2`;
  const lenderEmail = `info.m1.${stamp}@kumvwa.test`;

  let lenderToken = '';
  let clientToken = '';
  let tenantId = '';
  let clientEmail = '';
  let inviteToken = '';

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

  it('bootstraps platform terms v1 automatically', async () => {
    const res = await request(server()).get('/api/v1/terms/platform').expect(200);
    const body = res.body as { version: number; body: string };
    expect(body.version).toBe(1);
    expect(body.body).toContain('NOT a lender');
  });

  it('rejects registration without accepting current terms', async () => {
    await request(server())
      .post('/api/v1/auth/otp/request')
      .send({ phone: lenderPhone, purpose: 'registration' })
      .expect(200);
    const v = await request(server())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: lenderPhone, purpose: 'registration', code: '123456' })
      .expect(200);

    await request(server())
      .post('/api/v1/auth/register/tenant')
      .send({
        phone: lenderPhone,
        password,
        email: lenderEmail,
        businessName: 'M1 SACCO',
        businessType: 'sacco',
        contactPerson: 'Ms. Bwalya',
        otpToken: (v.body as { otpToken: string }).otpToken,
        acceptedTermsVersion: 99, // stale/wrong
      })
      .expect(400);
  });

  it('registers with terms acceptance → acceptance recorded + business info stored', async () => {
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
        businessName: 'M1 SACCO',
        businessType: 'sacco',
        otpToken: (v.body as { otpToken: string }).otpToken,
        acceptedTermsVersion: 1,
        email: lenderEmail,
        address: 'Plot 7, Lusaka',
        contactPerson: 'Ms. Bwalya',
      })
      .expect(201);
    const body = reg.body as {
      tenantId: string;
      accessToken: string;
      user: { userId: string };
    };
    tenantId = body.tenantId;
    lenderToken = body.accessToken;

    // Leave the BOZ gate so the loan/console flows aren't blocked.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active' },
    });

    const acc = await prisma.termsAcceptance.findFirstOrThrow({
      where: { actorId: body.user.userId, scope: 'platform_business' },
    });
    expect(acc.platformVersion).toBe(1);

    const t = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    expect(t.email).toBe(lenderEmail);
    expect(t.contactPerson).toBe('Ms. Bwalya');
  });

  it('invite requires email + queues the invite email', async () => {
    // missing email → validation error
    await request(server())
      .post('/api/v1/invites')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ clientName: 'No Email Client', phone: clientPhone })
      .expect(400);

    clientEmail = `client${stamp}@test.zm`;
    const invite = await request(server())
      .post('/api/v1/invites')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ clientName: 'Profile Tester', phone: clientPhone, email: clientEmail })
      .expect(201);
    const inviteBody = invite.body as { id: string; token: string };
    inviteToken = inviteBody.token;

    const mail = await prisma.emailOutbox.findFirstOrThrow({
      where: { to: clientEmail, purpose: 'invite' },
    });
    expect(mail.subject).toContain('M1 SACCO');
    expect(mail.body).toContain(inviteToken);
  });

  it('client completes invite, logs in, submits profile stepper', async () => {
    // pre-login branding on the invite itself
    const view = await request(server())
      .get(`/api/v1/invites/${inviteToken}`)
      .expect(200);
    expect((view.body as { primaryColor: string }).primaryColor).toBe('#1A4FBF');

    await request(server())
      .post(`/api/v1/invites/${inviteToken}/complete`)
      .send({
        fullName: 'Profile Tester',
        nrc: '888111/22/3',
        dateOfBirth: '1997-03-03',
        address: 'Plot 12, Kabwata',
        password,
        consent: true,
      })
      .expect(201);

    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ phone: clientPhone, password })
      .expect(200);
    clientToken = (login.body as { accessToken: string }).accessToken;

    // status: platform terms NOT yet accepted by client
    const status = await request(server())
      .get('/api/v1/terms/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const statusBody = status.body as {
      platform: { accepted: boolean };
      lenders: { name: string; termsAccepted: boolean }[];
    };
    expect(statusBody.platform.accepted).toBe(false);
    expect(statusBody.lenders[0]!.name).toBe('M1 SACCO');
    expect(statusBody.lenders[0]!.termsAccepted).toBe(true); // no tenant terms published

    // client accepts platform terms
    await request(server())
      .post('/api/v1/terms/accept')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ scope: 'platform_client' })
      .expect(201);

    // profile stepper: partial save must NOT complete the profile
    const partial = await request(server())
      .put('/api/v1/clients/me/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ email: clientEmail, employmentStatus: 'self_employed' })
      .expect(200);
    expect(
      (partial.body as { profileCompleted: boolean }).profileCompleted,
    ).toBe(false);

    // ...and the gate must report the very fields that are still missing, so
    // the app binds the borrower to the stepper instead of waving them in.
    const partialMe = await request(server())
      .get('/api/v1/clients/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const partialRegistration = (
      partialMe.body as {
        registration: {
          action: string;
          missing: string[];
          openLoanCount: number;
        };
      }
    ).registration;
    expect(partialRegistration.action).toBe('complete_registration');
    expect(partialRegistration.missing).toEqual(
      expect.arrayContaining([
        'educationLevel',
        'incomeBand',
        'kinName',
        'kinPhone',
      ]),
    );
    expect(partialRegistration.missing).not.toContain('email');
    expect(partialRegistration.missing).not.toContain('employmentStatus');
    expect(partialRegistration.openLoanCount).toBe(0);

    // profile stepper: still incomplete with kin details missing
    const noKin = await request(server())
      .put('/api/v1/clients/me/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        email: clientEmail,
        employmentStatus: 'self_employed',
        educationLevel: 'degree',
        incomeBand: 'b1001_3000',
        incomeSource: 'Market stall at Soweto',
      })
      .expect(200);
    expect((noKin.body as { profileCompleted: boolean }).profileCompleted).toBe(
      false,
    );

    // NRC photos: both faces are optional, but each one that IS supplied must
    // be a real uploaded nrc_photo file, and it round-trips on `me`.
    const nrcUpload = await request(server())
      .post('/api/v1/files/client/upload-url')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ kind: 'nrc_photo', mime: 'image/jpeg', size: 1024 })
      .expect(201);
    const nrcUp = nrcUpload.body as { fileId: string; uploadUrl: string };
    await fetch(nrcUp.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: Buffer.alloc(1024, 7),
    });
    await request(server())
      .post(`/api/v1/files/client/${nrcUp.fileId}/confirm`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(201);

    // An unconfirmed file is not an upload — the back photo must be rejected.
    const pendingUpload = await request(server())
      .post('/api/v1/files/client/upload-url')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ kind: 'nrc_photo', mime: 'image/jpeg', size: 1024 })
      .expect(201);
    await request(server())
      .put('/api/v1/clients/me/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        email: clientEmail,
        nrcBackPhotoFileId: (pendingUpload.body as { fileId: string }).fileId,
      })
      .expect(400);

    // profile stepper: full required set completes the profile
    const prof = await request(server())
      .put('/api/v1/clients/me/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        email: clientEmail,
        employmentStatus: 'self_employed',
        educationLevel: 'degree',
        incomeBand: 'b1001_3000',
        incomeSource: 'Market stall at Soweto',
        kinName: 'Jane Tester',
        kinPhone: '0965550001',
        nrcPhotoFileId: nrcUp.fileId,
      })
      .expect(200);
    expect((prof.body as { profileCompleted: boolean }).profileCompleted).toBe(
      true,
    );

    const me = await request(server())
      .get('/api/v1/clients/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const meBody = me.body as {
      employmentStatus: string;
      profileCompleted: boolean;
      nrcPhotoFileId: string | null;
      registration: { action: string; missing: string[] };
    };
    expect(meBody.employmentStatus).toBe('self_employed');
    expect(meBody.profileCompleted).toBe(true);
    expect(meBody.nrcPhotoFileId).toBe(nrcUp.fileId);
    // Nothing required is outstanding any more, so the gate stands down.
    expect(meBody.registration.action).toBe('complete');
    expect(meBody.registration.missing).toEqual([]);
  });

  it('lender publishes terms v1→v2; client sees latest, accepts, status flips', async () => {
    await request(server())
      .post(`/api/v1/tenants/${tenantId}/terms`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ body: `M1 SACCO lending terms v1: repay on time. ${'x'.repeat(60)}` })
      .expect(201);
    await request(server())
      .post(`/api/v1/tenants/${tenantId}/terms`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ body: `M1 SACCO lending terms v2: updated policy. ${'y'.repeat(60)}` })
      .expect(201);

    const info = await request(server())
      .get(`/api/v1/tenants/${tenantId}/public-info`)
      .expect(200);
    expect((info.body as { terms: { version: number } }).terms.version).toBe(2);

    const before = await request(server())
      .get('/api/v1/terms/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const beforeLenders = (before.body as {
      lenders: { termsVersion: number | null; termsAccepted: boolean }[];
    }).lenders;
    expect(beforeLenders[0]!.termsVersion).toBe(2);
    expect(beforeLenders[0]!.termsAccepted).toBe(false);

    await request(server())
      .post('/api/v1/terms/accept')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ scope: 'tenant', tenantId })
      .expect(201);

    const after = await request(server())
      .get('/api/v1/terms/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const afterLenders = (after.body as {
      lenders: { termsAccepted: boolean }[];
    }).lenders;
    expect(afterLenders[0]!.termsAccepted).toBe(true);
  });

  it('branding: color validation, logo upload, public-info reflects it', async () => {
    await request(server())
      .patch('/api/v1/tenants/me/branding')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ primaryColor: 'not-a-color' })
      .expect(400);

    const up = await request(server())
      .post('/api/v1/files/upload-url')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({ kind: 'tenant_logo', mime: 'image/png', size: 2048 })
      .expect(201);
    const upBody = up.body as { fileId: string; uploadUrl: string };
    await fetch(upBody.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: Buffer.alloc(2048, 1),
    });
    await request(server())
      .post(`/api/v1/files/${upBody.fileId}/confirm`)
      .set('Authorization', `Bearer ${lenderToken}`)
      .expect(201);

    await request(server())
      .patch('/api/v1/tenants/me/branding')
      .set('Authorization', `Bearer ${lenderToken}`)
      .send({
        primaryColor: '#7C3AED',
        tagline: 'Community lending, done right',
        logoFileId: upBody.fileId,
      })
      .expect(200);

    const info = await request(server())
      .get(`/api/v1/tenants/${tenantId}/public-info`)
      .expect(200);
    const infoBody = info.body as { primaryColor: string; logoUrl: string | null };
    expect(infoBody.primaryColor).toBe('#7C3AED');
    expect(infoBody.logoUrl).toContain('http');

    // and the client's lender-status branding follows
    const status = await request(server())
      .get('/api/v1/terms/status')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const lenders = (status.body as {
      lenders: { primaryColor: string; logoUrl: string | null }[];
    }).lenders;
    expect(lenders[0]!.primaryColor).toBe('#7C3AED');
    expect(lenders[0]!.logoUrl).toBeTruthy();
  });
});
