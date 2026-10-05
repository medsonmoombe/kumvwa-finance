import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type Redis from 'ioredis';
import type { User } from '@prisma/client';
import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@kumvwa/core';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma.module';
import { REDIS } from '../../infra/redis.module';
import { PasswordService } from '../../common/crypto/password.service';
import { TokenService } from '../../common/crypto/token.service';
import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { EmailService } from '../../common/email/email.service';
import { AuditService } from '../audit/audit.service';
import { PlatformService } from '../admin/platform.service';
import { TermsService } from '../terms/terms.service';
import { FilesService } from '../files/files.service';
import { normalizeZmPhone } from '../../common/utils/phone.util';
import {
  ChangePasswordDto,
  ConsoleLoginDto,
  ConsoleVerifyDto,
  ForgotPasswordDto,
  LoginDto,
  OtpRequestDto,
  OtpVerifyDto,
  RegisterTenantDto,
  RedeemMobileAccessCodeDto,
  ResetPasswordDto,
} from './dto/auth.dto';

const MAX_PENDING_OTPS = 3; // per phone+purpose within the TTL window

/**
 * Brute-force lockout. The counter lives in Redis so it survives across the
 * (horizontally scaled) API instances — an in-memory counter would let an
 * attacker simply rotate through pods.
 */
const MAX_LOGIN_FAILURES = 5;
const LOCK_TTL_SEC = 900; // 15 minutes
const MOBILE_ACCESS_CODE_TTL_MS = 10 * 60_000;
const MOBILE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly terms: TermsService,
    private readonly platform: PlatformService,
    private readonly email: EmailService,
    private readonly nrc: NrcCryptoService,
    private readonly files: FilesService,
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  // ───────────────────────── OTP ─────────────────────────

  async requestOtp(dto: OtpRequestDto) {
    const phone = this.mustPhone(dto.phone);

    const pending = await this.prisma.otpCode.count({
      where: {
        phone,
        purpose: dto.purpose as never,
        status: 'pending',
        createdAt: { gte: new Date(Date.now() - this.env.OTP_TTL_MIN * 60_000) },
      },
    });
    if (pending >= MAX_PENDING_OTPS) {
      throw new BadRequestException('Too many codes requested — try later');
    }

    const code = this.env.OTP_DEV_MODE
      ? this.env.OTP_DEV_CODE
      : randomInt(0, 1_000_000).toString().padStart(6, '0');

    const row = await this.prisma.otpCode.create({
      data: {
        phone,
        purpose: dto.purpose as never,
        codeHash: await this.passwords.hash(code),
        expiresAt: new Date(Date.now() + this.env.OTP_TTL_MIN * 60_000),
      },
    });

    // Outbox row: the future SMS worker's input. provider=none → marked sent
    // with the code visible in dev logs only.
    await this.prisma.smsOutbox.create({
      data: {
        phone,
        body: `Your Kumvwa Finance verification code is ${code}`,
        purpose: 'otp',
        status: this.env.SMS_PROVIDER === 'none' ? 'sent' : 'queued',
        provider: this.env.SMS_PROVIDER === 'none' ? 'dev-console' : null,
        sentAt: this.env.SMS_PROVIDER === 'none' ? new Date() : null,
      },
    });

    // Console 2FA is email-native. The legacy phone OTP flow also emails a
    // code whenever an address is known: supplied at registration or already
    // attached to the account for password recovery.
    const suppliedEmail = dto.email?.trim().toLowerCase();
    const account = suppliedEmail
      ? null
      : await this.prisma.user.findUnique({
          where: { phone },
          select: { email: true },
        });
    const email = suppliedEmail ?? account?.email;
    if (email) {
      const body = `Your verification code is ${code}. It expires in ${this.env.OTP_TTL_MIN} minutes. If you did not request it, you can ignore this email.`;
      await this.prisma.emailOutbox.create({ data: { to: email, subject: 'Kumvwa verification code', body, purpose: 'otp' } });
      await this.email.send(email, 'Kumvwa verification code', body);
    }

    this.logger.log(`OTP for ${phone}: ${code}`); // dev visibility only

    return {
      requestId: row.id,
      expiresInMin: this.env.OTP_TTL_MIN,
      ...(this.env.OTP_DEV_MODE ? { devCode: code } : {}),
    };
  }

  async verifyOtp(dto: OtpVerifyDto): Promise<{ otpToken: string }> {
    const phone = this.mustPhone(dto.phone);
    await this.assertNotLocked(phone);

    const row = await this.prisma.otpCode.findFirst({
      where: { phone, purpose: dto.purpose as never, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw new BadRequestException('No active code — request one');

    if (row.expiresAt < new Date()) {
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Code expired — request a new one');
    }

    const ok = await this.passwords.verify(row.codeHash, dto.code);
    if (!ok) {
      const attempts = row.attempts + 1;
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: {
          attempts,
          ...(attempts >= this.env.OTP_MAX_ATTEMPTS
            ? { status: 'expired' as const }
            : {}),
        },
      });
      await this.registerFailure(phone);
      throw new BadRequestException('Incorrect code');
    }
    await this.registerFailure(phone, true);

    await this.prisma.otpCode.update({
      where: { id: row.id },
      data: { status: 'consumed', consumedAt: new Date() },
    });

    const otpToken = await this.tokens.signOtpToken(
      phone,
      dto.purpose,
      row.id,
    );
    return { otpToken };
  }

  // ─────────────────── Registration (OTP-verified when offered) ───────────────────

  async registerTenant(dto: RegisterTenantDto, req: Request) {
    // The signup kill-switch: existing lenders keep working, but the platform
    // stops accepting new applications. Checked first so a closed platform
    // never leaks "this phone is registered" style information.
    const signupsOpen = await this.platform.getFlag('signup_enabled');
    if (!signupsOpen) {
      throw new ServiceUnavailableException({
        message: 'New business registrations are temporarily closed. Please try again shortly.',
        code: 'SIGNUP_DISABLED',
      });
    }

    const phone = this.mustPhone(dto.phone);
    const tpin = dto.tpin?.trim();
    if (!tpin) throw new BadRequestException('TPIN is required');

    // The console signs a lender up without an SMS step, so a token is
    // optional. When one IS sent (the mobile app), it still has to match this
    // phone number — a token can never be used to register a different one.
    if (dto.otpToken) {
      const claims = await this.tokens.verify(dto.otpToken, 'otp');
      if (claims.purpose !== 'registration' || claims.phone !== phone) {
        throw new UnauthorizedException('Phone verification required');
      }
    }

    const exists = await this.prisma.user.findUnique({ where: { phone } });
    if (exists) throw new ConflictException('Phone already registered');

    if (dto.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (emailTaken) throw new ConflictException('Email already registered');
    }

    // Terms acceptance is mandatory at registration. The UI shows the current
    // version; a stale/absent version means the text changed under them.
    const terms = await this.terms.platformLatest();
    if (!terms || dto.acceptedTermsVersion !== terms.version) {
      throw new BadRequestException('You must accept the current platform terms');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.businessName.trim(),
          type: dto.businessType,
          email: dto.email?.toLowerCase(),
          address: dto.address?.trim(),
          tpin,
          contactPerson: dto.contactPerson.trim(),
          businessDescription: dto.businessDescription.trim(),
          ownerNrcEncrypted: this.nrc.encrypt(dto.ownerNrc.trim()),
          // Dev convenience: skip the BOZ gate so the whole loop is testable
          // without object storage. The gate itself stays in place for prod,
          // and a platform that has turned manual review off opts out too.
          status: this.env.DEV_AUTO_VERIFY_TENANTS ||
            !(await this.platform.getFlag('new_registrations_require_review'))
            ? 'active'
            : 'pending_verification',
        },
      });
      const user = await tx.user.create({
        data: {
          phone,
          email: dto.email?.trim().toLowerCase(),
          passwordHash,
          displayName: dto.businessName,
          role: 'tenant_owner',
          tenantId: tenant.id,
        },
      });
      await tx.role.createMany({
        data: SYSTEM_ROLES.map((role) => ({
          tenantId: tenant.id,
          name: role.name,
          isSystem: true,
          permissions: role.permissions,
        })),
      });
      await tx.tenantReviewEvent.create({
        data: {
          tenantId: tenant.id,
          actorId: user.id,
          action: 'registered',
          note: 'Business application created and placed in the review queue.',
        },
      });
      return { tenant, user };
    });

    await this.audit.record({
      actorId: user.id,
      action: 'auth.register_tenant',
      description: `New lender "${dto.businessName.trim()}" registered and awaiting platform review`,
      entity: 'Tenant',
      entityId: tenant.id,
      tenantId: tenant.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Audit the acceptance against the exact version they agreed to.
    await this.terms.accept({
      actorId: user.id,
      clientId: null,
      scope: 'platform_business',
      ip: req.ip,
    });

    return {
      user: await this.sessionUser(user),
      tenantId: tenant.id,
      tenantStatus: tenant.status,
      ...(await this.issueTokens(user, req)),
    };
  }

  // ───────────────────────── Login ─────────────────────────

  async login(dto: LoginDto, req: Request) {
    const phone = this.mustPhone(dto.phone);
    await this.assertNotLocked(phone);

    const user = await this.prisma.user.findUnique({ where: { phone } });

    // Constant-shape failure: same error for unknown phone and bad password,
    // plus a dummy verify to keep timing uniform.
    if (
      !user ||
      user.status !== 'active' ||
      !(await this.passwords.verify(user.passwordHash, dto.password))
    ) {
      if (!user) await this.passwords.hash(dto.password); // timing pad
      await this.registerFailure(phone);
      throw new UnauthorizedException('Invalid phone number or password');
    }

    await this.registerFailure(phone, true);

    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      description: `User signed in via mobile app`,
      entity: 'User',
      entityId: user.id,
      tenantId: user.tenantId ?? undefined,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      user: await this.sessionUser(user),
      ...(await this.issueTokens(user, req)),
    };
  }

  async consoleLogin(
    dto: ConsoleLoginDto,
    req: Request,
    deviceToken?: string,
  ) {
    const email = dto.email.trim().toLowerCase();
    await this.assertNotLocked(`email:${email}`);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid =
      user &&
      user.status === 'active' &&
      user.role !== 'client' &&
      (await this.passwords.verify(user.passwordHash, dto.password));
    if (!valid) {
      if (!user) await this.passwords.hash(dto.password);
      await this.registerFailure(`email:${email}`);
      await this.audit.record({
        action: 'auth.console.login_failed',
        description: `Failed console login attempt for ${email}`,
        entity: 'User',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.registerFailure(`email:${email}`, true);

    if (await this.trustedDeviceOk(user.id, deviceToken)) {
      await this.audit.record({
        actorId: user.id,
        action: 'auth.console.login_trusted_device',
        description: `Console sign-in via trusted device (no 2FA required)`,
        entity: 'User',
        entityId: user.id,
        tenantId: user.tenantId ?? undefined,
        ip: req.ip,
      });
      return this.issueConsoleTokens(user, req);
    }
    if (!user.twoFactorEnabled || this.env.CONSOLE_OTP_FLOW === 'disabled') return this.issueConsoleTokens(user, req);

    const code = this.env.OTP_DEV_MODE
      ? this.env.OTP_DEV_CODE
      : randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.otpCode.updateMany({
      where: { userId: user.id, purpose: 'console_2fa', status: 'pending' },
      data: { status: 'expired' },
    });
    await this.prisma.otpCode.create({
      data: {
        phone: user.phone,
        userId: user.id,
        purpose: 'console_2fa',
        codeHash: await this.passwords.hash(code),
        expiresAt: new Date(Date.now() + this.env.CONSOLE_2FA_TTL_MIN * 60_000),
      },
    });
    const body2fa = `Your sign-in code is ${code}. It expires in ${this.env.CONSOLE_2FA_TTL_MIN} minutes.`;
    await this.prisma.emailOutbox.create({ data: { to: email, subject: 'Kumvwa Console sign-in code', body: body2fa, purpose: 'otp' } });
    await this.email.send(email, 'Kumvwa Console sign-in code', body2fa);
    return {
      stage: '2fa' as const,
      preToken: await this.tokens.signPre2fa(user.id, randomBytes(16).toString('hex')),
      expiresInMin: this.env.CONSOLE_2FA_TTL_MIN,
      ...(this.env.OTP_DEV_MODE ? { devCode: code } : {}),
    };
  }

  /** Existing lender accounts use their  email/password on mobile too. */
  async lenderMobileLogin(
    dto: ConsoleLoginDto,
    req: Request,
    deviceToken?: string,
  ) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !['tenant_owner', 'tenant_staff'].includes(user.role)) {
      if (!user) await this.passwords.hash(dto.password);
      await this.registerFailure(`email:${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.consoleLogin(dto, req, deviceToken);
  }

  /**
   * Public feature flag the console reads before login so it can hide the OTP
   * screen entirely when the flow is switched off (e.g. broken email delivery).
   * Mobile login already issues tokens without a console 2FA step, so this only
   * governs the management console.
   */
  consoleOtpFlow(): { otpFlow: 'enabled' | 'disabled' } {
    return { otpFlow: this.env.CONSOLE_OTP_FLOW };
  }

  async consoleVerify2fa(dto: ConsoleVerifyDto, req: Request) {
    const claims = await this.tokens.verify(dto.preToken, 'pre2fa');
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    const row = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, purpose: 'console_2fa', status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Code expired - start again');
    }
    if (!(await this.passwords.verify(row.codeHash, dto.code))) {
      const attempts = row.attempts + 1;
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { attempts, ...(attempts >= this.env.OTP_MAX_ATTEMPTS ? { status: 'expired' } : {}) },
      });
      await this.audit.record({ actorId: user.id, action: 'auth.console.2fa_failed', description: 'Incorrect 2FA code entered during console sign-in', entity: 'User', entityId: user.id, ip: req.ip });
      throw new UnauthorizedException('Incorrect code');
    }
    await this.prisma.otpCode.update({ where: { id: row.id }, data: { status: 'consumed', consumedAt: new Date() } });
    let deviceToken: string | undefined;
    if (dto.rememberDevice) {
      deviceToken = randomBytes(32).toString('base64url');
      await this.prisma.trustedDevice.create({
        data: { userId: user.id, tokenHash: this.deviceHash(deviceToken), label: req.headers['user-agent']?.slice(0, 120), expiresAt: new Date(Date.now() + this.env.TRUSTED_DEVICE_DAYS * 86_400_000) },
      });
    }
    await this.audit.record({ actorId: user.id, action: 'auth.console.2fa_success', description: 'Console sign-in completed successfully after 2FA verification', entity: 'User', entityId: user.id, tenantId: user.tenantId ?? undefined, ip: req.ip });
    return { ...(await this.issueConsoleTokens(user, req)), deviceToken };
  }

  async lenderMobileVerify2fa(dto: ConsoleVerifyDto, req: Request) {
    const claims = await this.tokens.verify(dto.preToken, 'pre2fa');
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || !['tenant_owner', 'tenant_staff'].includes(user.role)) {
      throw new UnauthorizedException();
    }
    return this.consoleVerify2fa(dto, req);
  }

  async createOwnLenderMobileAccessCode(actorId: string) {
    return this.createLenderMobileAccessCode(actorId, actorId, 'lender');
  }

  async createLenderMobileAccessCodeForTenant(adminId: string, tenantId: string) {
    const owner = await this.prisma.user.findFirst({ where: { tenantId, role: 'tenant_owner', status: 'active' }, select: { id: true } });
    if (!owner) throw new BadRequestException('This lender has no active owner account');
    return this.createLenderMobileAccessCode(adminId, owner.id, 'platform_admin');
  }

  async redeemLenderMobileAccessCode(dto: RedeemMobileAccessCodeDto, req: Request) {
    const hash = this.hashMobileAccessCode(dto.code);
    let code;
    try {
      code = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "MobileAccessCode" WHERE "codeHash" = ${hash} FOR UPDATE`;
        const rows = await tx.$queryRaw<Array<{ id: string; userId: string; tenantId: string; generatedBy: string; usedAt: Date | null; expiresAt: Date }>>`SELECT "id", "userId", "tenantId", "generatedBy", "usedAt", "expiresAt" FROM "MobileAccessCode" WHERE "codeHash" = ${hash}`;
        const row = rows[0];
        if (!row || row.usedAt || row.expiresAt <= new Date()) throw new UnauthorizedException('This access code is invalid or has expired');
        const user = await tx.user.findUnique({ where: { id: row.userId } });
        if (!user || user.status !== 'active' || !['tenant_owner', 'tenant_staff'].includes(user.role)) throw new UnauthorizedException('This access code is no longer valid');
        const tenant = await tx.tenant.findUnique({ where: { id: row.tenantId }, select: { status: true } });
        if (tenant?.status !== 'active') throw new UnauthorizedException('This lender is not approved for mobile access');
        const used = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "MobileAccessCode" SET "usedAt" = NOW() WHERE "id" = ${row.id} AND "usedAt" IS NULL AND "expiresAt" > NOW() RETURNING "id"`;
        if (used.length !== 1) throw new UnauthorizedException('This access code is invalid or has expired');
        return { ...row, user };
      });
    } catch (error) {
      await this.audit.record({ action: 'auth.mobile_access_code_redeem_failed', description: 'Failed attempt to redeem a lender mobile access code', entity: 'MobileAccessCode', ip: req.ip, userAgent: req.headers['user-agent'] });
      throw error;
    }
    await this.audit.record({ actorId: code.userId, action: 'auth.mobile_access_code_redeemed', description: 'Lender mobile access code redeemed — session issued', entity: 'MobileAccessCode', entityId: code.id, tenantId: code.tenantId, ip: req.ip, userAgent: req.headers['user-agent'], diff: { generatedBy: code.generatedBy } });
    return this.issueTokens(code.user, req);
  }

  private async createLenderMobileAccessCode(actorId: string, targetUserId: string, source: 'lender' | 'platform_admin') {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user || !user.tenantId || !['tenant_owner', 'tenant_staff'].includes(user.role) || user.status !== 'active') throw new BadRequestException('An active lender owner or staff account is required');
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { status: true } });
    if (tenant?.status !== 'active') throw new BadRequestException('Only approved lender accounts can use mobile access codes');
    const raw = this.newMobileAccessCode();
    const expiresAt = new Date(Date.now() + MOBILE_ACCESS_CODE_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "MobileAccessCode" SET "usedAt" = NOW() WHERE "userId" = ${user.id} AND "usedAt" IS NULL AND "expiresAt" > NOW()`;
      await tx.$executeRaw`INSERT INTO "MobileAccessCode" ("id", "codeHash", "userId", "tenantId", "generatedBy", "expiresAt", "createdAt") VALUES (${randomBytes(16).toString('hex')}, ${this.hashMobileAccessCode(raw)}, ${user.id}, ${user.tenantId}, ${actorId}, ${expiresAt}, NOW())`;
    });
    await this.audit.record({ actorId, action: 'auth.mobile_access_code_generated', description: `Mobile access code generated for lender by ${source === 'platform_admin' ? 'platform admin' : 'lender'}`, entity: 'User', entityId: user.id, tenantId: user.tenantId, diff: { source, expiresAt: expiresAt.toISOString() } });
    return { code: `KML-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`, expiresAt };
  }

  // ─────────────── Password recovery (OTP-gated) ───────────────

  /**
   * Industry-standard anti-enumeration: the response is identical whether or
   * not the phone has an account, so you cannot mine which numbers are
   * registered. The OTP is harmless when the phone is unknown — the reset
   * step simply fails later for a non-existent account.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const user = await this.prisma.user.findFirst({ where: { email } });
      if (!user) {
        return { sent: true };
      }
      const code = this.env.OTP_DEV_MODE
        ? this.env.OTP_DEV_CODE
        : randomInt(0, 1_000_000).toString().padStart(6, '0');

      await this.prisma.otpCode.updateMany({
        where: { userId: user.id, purpose: 'password_reset', status: 'pending' },
        data: { status: 'expired' },
      });

      await this.prisma.otpCode.create({
        data: {
          phone: user.phone,
          userId: user.id,
          purpose: 'password_reset',
          codeHash: await this.passwords.hash(code),
          expiresAt: new Date(Date.now() + this.env.OTP_TTL_MIN * 60_000),
        },
      });

      const bodyReset = `Your password reset code is ${code}. It expires in ${this.env.OTP_TTL_MIN} minutes.`;
      await this.prisma.emailOutbox.create({ data: { to: email, subject: 'Kumvwa password reset code', body: bodyReset, purpose: 'otp' } });
      await this.email.send(email, 'Kumvwa password reset code', bodyReset);

      return {
        sent: true,
        ...(this.env.OTP_DEV_MODE ? { devCode: code } : {}),
      };
    }

    if (!dto.phone) {
      throw new BadRequestException('Email or phone is required');
    }
    return this.requestOtp({ phone: dto.phone, purpose: 'password_reset' });
  }

  /** Set a new password after proof-of-identity (email code or phone OTP), then kill every session. */
  async resetPassword(dto: ResetPasswordDto, req: Request) {
    let user: User | null = null;
    let lockoutPhone: string | null = null;

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      user = await this.prisma.user.findFirst({ where: { email } });
      if (!user) throw new BadRequestException('No account found for this email');

      if (!dto.code) throw new BadRequestException('Verification code is required');

      const row = await this.prisma.otpCode.findFirst({
        where: { userId: user.id, purpose: 'password_reset', status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });

      if (!row || row.expiresAt < new Date()) {
        throw new BadRequestException('Code expired or invalid — request a new one');
      }

      const ok = await this.passwords.verify(row.codeHash, dto.code);
      if (!ok) {
        throw new BadRequestException('Incorrect verification code');
      }

      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { status: 'consumed', consumedAt: new Date() },
      });
      lockoutPhone = user.phone;
    } else if (dto.phone) {
      const phone = this.mustPhone(dto.phone);
      if (!dto.otpToken) {
        throw new BadRequestException('OTP token required for phone reset');
      }
      const claims = await this.tokens.verify(dto.otpToken, 'otp');
      if (claims.purpose !== 'password_reset' || claims.phone !== phone) {
        throw new UnauthorizedException('Phone verification required');
      }

      user = await this.prisma.user.findUnique({ where: { phone } });
      if (!user) throw new BadRequestException('No account for this phone');
      lockoutPhone = phone;
    } else {
      throw new BadRequestException('Email or phone is required');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Password changed → every existing session is dead on arrival.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    if (lockoutPhone) {
      await this.registerFailure(lockoutPhone, true); // clear the login lockout
    }
    await this.audit.record({
      actorId: user.id,
      action: 'auth.password_reset',
      description: 'User password was reset via verified recovery flow',
      entity: 'User',
      entityId: user.id,
      tenantId: user.tenantId ?? undefined,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return { ok: true };
  }

  /** Signed-in password change: verify the current one, then rotate. */
  async changePassword(
    dto: ChangePasswordDto,
    userId: string,
    req: Request,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.audit.record({
      actorId: userId,
      action: 'auth.password_change',
      description: 'User changed their own password while signed in',
      entity: 'User',
      entityId: userId,
      tenantId: user.tenantId ?? undefined,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return { ok: true };
  }

  // ─────────────── Refresh with rotation + reuse detection ───────────────

  async refresh(rawToken: string, req: Request) {
    const claims = await this.tokens.verify(rawToken, 'refresh');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.revokedAt) {
      // REUSE DETECTED: a rotated/revoked token was presented. Nuke the family.
      await this.prisma.refreshToken.updateMany({
        where: { sessionId: stored.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorId: claims.sub,
        action: 'auth.refresh_reuse_detected',
        description: 'Refresh token reuse detected — entire session family revoked',
        entity: 'RefreshToken',
        entityId: stored.id,
        tenantId: stored.sessionId,
        ip: req.ip,
      });
      throw new UnauthorizedException('Session revoked — please log in again');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException();
    }

    // Rotate: revoke presented token, mint a sibling in the same family.
    const newJti = randomBytes(16).toString('hex');
    const newRaw = await this.tokens.signRefreshToken(user, newJti);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(newRaw),
          sessionId: stored.sessionId,
          rotatedFrom: stored.id,
          ip: req.ip,
          deviceId: stored.deviceId,
          expiresAt: new Date(
            Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
          ),
        },
      }),
    ]);

    return {
      user: await this.sessionUser(user),
      accessToken: await this.tokens.signAccessToken({
        ...user,
        permissions: await this.permissionsFor(user),
      }),
      refreshToken: newRaw,
    };
  }

  async logout(rawToken: string, req: Request) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });
    if (stored && !stored.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorId: stored.userId,
        action: 'auth.logout',
        description: 'User signed out and session token revoked',
        ip: req.ip,
      });
    }
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        displayName: true,
        role: true,
        tenantId: true,
        clientId: true,
        profileFileId: true,
        profileFile: { select: { storageKey: true, mime: true } },
      },
    });
    return this.sessionUser(user);
  }

  async get2faStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return { twoFactorEnabled: user.twoFactorEnabled };
  }

  async set2fa(userId: string, enabled: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: enabled },
    });
    return { twoFactorEnabled: enabled };
  }

  async devices(userId: string) {
    return this.prisma.trustedDevice.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true, label: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeDevice(userId: string, deviceId: string, req: Request) {
    const device = await this.prisma.trustedDevice.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) throw new BadRequestException('Trusted device not found');
    await this.prisma.trustedDevice.delete({ where: { id: device.id } });
    await this.audit.record({
      actorId: userId,
      action: 'auth.console.trusted_device_revoked',
      description: 'Trusted device removed — future sign-ins from this device will require 2FA',
      entity: 'TrustedDevice',
      entityId: device.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { ok: true };
  }

  // ───────────────────────── helpers ─────────────────────────

  /**
   * Session shape sent to the mobile app on login / refresh / me. Client
   * users additionally carry profile-completion info so the app can gate
   * loan features until the KYC wizard is finished.
   */
  private async sessionUser(u: {
    id: string;
    displayName: string;
    phone: string;
    role: string;
    clientId?: string | null;
    profileFileId?: string | null;
    profileFile?: { storageKey: string; mime: string } | null;
  }) {
    const profileImageUrl = u.profileFile
      ? await this.files.presignGet(u.profileFile.storageKey, u.profileFile.mime)
      : null;
    if (u.role === 'client' && u.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: u.clientId },
        select: { nrcHash: true, dob: true, address: true },
      });
      let percent = 40;
      if (client?.nrcHash) percent += 20;
      if (client?.dob) percent += 20;
      if (client?.address && client.address.trim().length > 0) percent += 20;
      return {
        userId: u.id,
        displayName: u.displayName,
        phone: u.phone,
        role: u.role,
        profileComplete: percent >= 100,
        profilePercent: Math.min(percent, 100),
        profileFileId: u.profileFileId ?? null,
        profileImageUrl,
      };
    }
    return {
      userId: u.id,
      displayName: u.displayName,
      phone: u.phone,
      role: u.role,
      profileComplete: true,
      profilePercent: 100,
      profileFileId: u.profileFileId ?? null,
      profileImageUrl,
    };
  }

  /**
   * Refresh tokens are high-entropy random strings, so a keyed HMAC-SHA256 is
   * the right hash: deterministic (lookup by hash works) and cheap. Argon2
   * would be non-deterministic (random salt) — lookup-by-hash impossible.
   */
  private lockKey(phone: string): string {
    return `lock:${phone}`;
  }

  /**
   * Fails OPEN when Redis is unreachable: a cache outage must never lock every
   * legitimate user out of their account. Argon2 verification and the global
   * throttler still sit in front of the password check.
   */
  private async assertNotLocked(phone: string): Promise<void> {
    try {
      const n = await this.redis.get(this.lockKey(phone));
      if (n && Number(n) >= MAX_LOGIN_FAILURES) {
        throw new UnauthorizedException(
          'Too many failed attempts — try again in 15 minutes',
        );
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn({ err }, 'Lockout check skipped (Redis unavailable)');
    }
  }

  /** A success clears the counter; a failure starts/extends the 15-min window. */
  private async registerFailure(phone: string, ok = false): Promise<void> {
    try {
      if (ok) {
        await this.redis.del(this.lockKey(phone));
        return;
      }
      const n = await this.redis.incr(this.lockKey(phone));
      if (n === 1) {
        await this.redis.expire(this.lockKey(phone), LOCK_TTL_SEC);
      }
    } catch (err) {
      this.logger.warn(
        { err },
        'Lockout counter not updated (Redis unavailable)',
      );
    }
  }

  private hashToken(raw: string): string {
    return createHmac('sha256', this.env.JWT_REFRESH_SECRET)
      .update(raw)
      .digest('hex');
  }

  private hashMobileAccessCode(raw: string): string {
    const normalized = raw.replaceAll(/[^A-Za-z0-9]/g, '').toUpperCase();
    const code = normalized.startsWith('KML') ? normalized.slice(3) : normalized;
    return createHmac('sha256', this.env.JWT_ACCESS_SECRET).update(code).digest('hex');
  }

  private newMobileAccessCode(): string {
    return Array.from({ length: 16 }, () => MOBILE_CODE_ALPHABET[randomInt(0, MOBILE_CODE_ALPHABET.length)]).join('');
  }

  private deviceHash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async trustedDeviceOk(userId: string, raw?: string): Promise<boolean> {
    if (!raw) return false;
    const device = await this.prisma.trustedDevice.findFirst({
      where: { userId, tokenHash: this.deviceHash(raw), expiresAt: { gt: new Date() } },
    });
    return Boolean(device);
  }

  private async permissionsFor(user: Pick<User, 'role' | 'tenantId' | 'roleId'>): Promise<string[]> {
    if (user.role === 'platform_admin' || user.role === 'tenant_owner') {
      return ALL_PERMISSIONS;
    }
    if (user.role !== 'tenant_staff' || !user.tenantId || !user.roleId) return [];
    const role = await this.prisma.role.findFirst({
      where: { id: user.roleId, tenantId: user.tenantId },
      select: { permissions: true },
    });
    return role?.permissions ?? [];
  }

  private async issueConsoleTokens(user: User, req: Request) {
    return this.issueTokens(user, req);
  }

  private async issueTokens(user: User, req: Request) {
    const sessionId = randomBytes(16).toString('hex');
    const jti = randomBytes(16).toString('hex');
    const refreshToken = await this.tokens.signRefreshToken(user, jti);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        sessionId,
        ip: req.ip,
        expiresAt: new Date(
          Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
        ),
      },
    });

    return {
      accessToken: await this.tokens.signAccessToken({
        ...user,
        permissions: await this.permissionsFor(user),
      }),
      refreshToken,
    };
  }

  private mustPhone(raw: string): string {
    const phone = normalizeZmPhone(raw);
    if (!phone) throw new BadRequestException('Invalid Zambian phone number');
    return phone;
  }
}
