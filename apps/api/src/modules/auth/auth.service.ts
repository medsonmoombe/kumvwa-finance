import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import type { Request } from 'express';
import type { User } from '@prisma/client';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma.module';
import { PasswordService } from '../../common/crypto/password.service';
import { TokenService } from '../../common/crypto/token.service';
import { AuditService } from '../audit/audit.service';
import { normalizeZmPhone } from '../../common/utils/phone.util';
import {
  LoginDto,
  OtpRequestDto,
  OtpVerifyDto,
  RegisterTenantDto,
} from './dto/auth.dto';

const MAX_PENDING_OTPS = 3; // per phone+purpose within the TTL window

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
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

    this.logger.log(`OTP for ${phone}: ${code}`); // dev visibility only

    return {
      requestId: row.id,
      expiresInMin: this.env.OTP_TTL_MIN,
      ...(this.env.OTP_DEV_MODE ? { devCode: code } : {}),
    };
  }

  async verifyOtp(dto: OtpVerifyDto): Promise<{ otpToken: string }> {
    const phone = this.mustPhone(dto.phone);

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
      throw new BadRequestException('Incorrect code');
    }

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

  // ─────────────────── Registration (OTP-gated) ───────────────────

  async registerTenant(dto: RegisterTenantDto, req: Request) {
    const phone = this.mustPhone(dto.phone);
    const claims = await this.tokens.verify(dto.otpToken, 'otp');
    if (claims.purpose !== 'registration' || claims.phone !== phone) {
      throw new UnauthorizedException('Phone verification required');
    }

    const exists = await this.prisma.user.findUnique({ where: { phone } });
    if (exists) throw new ConflictException('Phone already registered');

    const passwordHash = await this.passwords.hash(dto.password);

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.businessName,
          type: dto.businessType,
          status: 'pending_verification', // BOZ review lands in B2
        },
      });
      const user = await tx.user.create({
        data: {
          phone,
          passwordHash,
          displayName: dto.businessName,
          role: 'tenant_owner',
          tenantId: tenant.id,
        },
      });
      return { tenant, user };
    });

    await this.audit.record({
      actorId: user.id,
      action: 'auth.register_tenant',
      entity: 'Tenant',
      entityId: tenant.id,
      tenantId: tenant.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      user: this.toSessionUser(user),
      tenantId: tenant.id,
      tenantStatus: tenant.status,
      ...(await this.issueTokens(user, req)),
    };
  }

  // ───────────────────────── Login ─────────────────────────

  async login(dto: LoginDto, req: Request) {
    const phone = this.mustPhone(dto.phone);
    const user = await this.prisma.user.findUnique({ where: { phone } });

    // Constant-shape failure: same error for unknown phone and bad password,
    // plus a dummy verify to keep timing uniform.
    if (
      !user ||
      user.status !== 'active' ||
      !(await this.passwords.verify(user.passwordHash, dto.password))
    ) {
      if (!user) await this.passwords.hash(dto.password); // timing pad
      throw new UnauthorizedException('Invalid phone number or password');
    }

    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      tenantId: user.tenantId ?? undefined,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      user: this.toSessionUser(user),
      ...(await this.issueTokens(user, req)),
    };
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
      user: this.toSessionUser(user),
      accessToken: await this.tokens.signAccessToken(user),
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
      },
    });
    return this.toSessionUser(user);
  }

  // ───────────────────────── helpers ─────────────────────────

  /**
   * Refresh tokens are high-entropy random strings, so a keyed HMAC-SHA256 is
   * the right hash: deterministic (lookup by hash works) and cheap. Argon2
   * would be non-deterministic (random salt) — lookup-by-hash impossible.
   */
  private hashToken(raw: string): string {
    return createHmac('sha256', this.env.JWT_REFRESH_SECRET)
      .update(raw)
      .digest('hex');
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
      accessToken: await this.tokens.signAccessToken(user),
      refreshToken,
    };
  }

  private toSessionUser(u: {
    id: string;
    displayName: string;
    phone: string;
    role: string;
  }) {
    // Shape-compatible with the mobile app's UserSession model.
    return {
      userId: u.id,
      displayName: u.displayName,
      phone: u.phone,
      role: u.role,
    };
  }

  private mustPhone(raw: string): string {
    const phone = normalizeZmPhone(raw);
    if (!phone) throw new BadRequestException('Invalid Zambian phone number');
    return phone;
  }
}
