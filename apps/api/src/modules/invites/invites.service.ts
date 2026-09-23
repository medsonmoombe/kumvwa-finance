import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import type { Request } from 'express';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { DEFAULT_PRIMARY_COLOR } from '../terms/terms.service';
import { PasswordService } from '../../common/crypto/password.service';
import { normalizeZmPhone } from '../../common/utils/phone.util';
import { Env, ENV } from '../../config/env';
import type { CompleteInviteDto, CreateInviteDto } from './dto/invites.dto';

const INVITE_TTL_DAYS = 7;

/**
 * Human-typeable invite code: "KMV-" + 5 chars from an ambiguity-free
 * alphabet (no 0/O, 1/I/L). Typed into the mobile app's invite screen.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_BODY_LEN = 5;

/**
 * Lender → client onboarding. The lender invites a phone number; the client
 * completes onboarding once and is then linked to that lender. The same
 * person invited by a second lender is DEDUPED onto one Client row and just
 * gains a second ClientLenderLink.
 */
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
    private readonly passwords: PasswordService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(tenantId: string, actorId: string, dto: CreateInviteDto) {
    const phone = this.normalize(dto.phone);

    // Phone numbers are unique in this system. Refuse to mint a fresh invite
    // for a number that already registered (as a borrower OR a lender) or
    // that already has a pending invite — otherwise a second invite would sit
    // in limbo, or worse, silently link somebody to a lender they don't want.
    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('This phone number is already registered');
    }
    const duplicate = await this.prisma.invite.findFirst({
      where: { tenantId, phone, status: 'pending' },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'This phone number already has a pending invite',
      );
    }

    const code = await this.newCode();
    const invite = await this.prisma.invite.create({
      data: {
        tokenHash: this.hashToken(code),
        tenantId,
        clientName: dto.clientName.trim(),
        phone,
        createdBy: actorId,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      },
    });

    await this.audit.record({
      actorId,
      action: 'invite.create',
      entity: 'Invite',
      entityId: invite.id,
      tenantId,
      diff: { phone },
    });

    // Invites go out by email now. The worker drains EmailOutbox over SMTP
    // (log-only in dev when SMTP_HOST is unset).
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    await this.prisma.emailOutbox.create({
      data: {
        to: dto.email.toLowerCase(),
        subject: `You're invited — ${tenant?.name ?? 'Kumvwa Finance'}`,
        body: [
          `Hi ${dto.clientName},`,
          '',
          `${tenant?.name ?? 'A lender'} has invited you to join them on Kumvwa Finance.`,
          '',
          '1. Download the Kumvwa Finance app (Android).',
          `2. Enter your invite code: ${code}`,
          `   Or tap this link on your phone: kumvwa:///invite/${code}`,
          '',
          `This invite expires on ${invite.expiresAt.toDateString()}.`,
        ].join('\n'),
        purpose: 'invite',
      },
    });

    // The raw code is returned exactly once — only its hash is stored.
    // `token` is kept as a legacy alias for existing console callers.
    // `link` is the app download page so the share card can pair the
    // download link with the redemption code.
    return {
      id: invite.id,
      code,
      token: code,
      clientName: invite.clientName,
      phone: invite.phone,
      expiresAt: invite.expiresAt,
      link: this.env.APP_DOWNLOAD_URL,
    };
  }

  /**
   * Public pre-claim lookup so the mobile app can show who invited whom
   * before the client commits. Deliberately minimal: masked phone, no PII.
   */
  async lookup(code: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: this.hashToken(code) },
      include: { tenant: { include: { logoFile: true } } },
    });
    if (!invite || invite.status !== 'pending') {
      throw new NotFoundException('Invite not found');
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      throw new NotFoundException('Invite not found');
    }

    return {
      clientName: invite.clientName,
      businessName: invite.tenant.name,
      phoneMasked: this.maskPhone(invite.phone),
      expiresAt: invite.expiresAt,
      // Contextual white-label: the pre-login invite screen shows the
      // inviting lender's branding from the moment the code is entered.
      primaryColor: invite.tenant.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      tagline: invite.tenant.tagline,
      logoUrl: invite.tenant.logoFile
        ? await this.files.presignGet(invite.tenant.logoFile.storageKey)
        : null,
      // The invited person still needs the app before they can redeem the
      // code in-app, so the public lookup surfaces the download link too.
      link: this.env.APP_DOWNLOAD_URL,
    };
  }

  async complete(code: string, dto: CompleteInviteDto, req: Request) {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: this.hashToken(code) },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== 'pending') {
      throw new ConflictException('Invite already used');
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Invite expired — ask for a new one');
    }

    // Option-A flow: the invite mints the ACCOUNT only (name + password).
    // KYC lands later via the app's profile wizard (PATCH /clients/me/profile).
    const phoneTaken = await this.prisma.user.findUnique({
      where: { phone: invite.phone },
      include: { client: { select: { id: true } } },
    });

    // ── Dedupe path: same person, second lender → link + complete only ──
    // The client keeps their existing login; no second account is created.
    if (phoneTaken) {
      if (!phoneTaken.clientId) {
        throw new ConflictException(
          'Phone already registered — finish your profile in the app',
        );
      }
      await this.prisma.$transaction([
        this.prisma.clientLenderLink.upsert({
          where: {
            clientId_tenantId: {
              clientId: phoneTaken.clientId,
              tenantId: invite.tenantId,
            },
          },
          create: {
            clientId: phoneTaken.clientId,
            tenantId: invite.tenantId,
          },
          update: {},
        }),
        this.prisma.invite.update({
          where: { id: invite.id },
          data: {
            status: 'completed',
            clientId: phoneTaken.clientId,
            completedAt: new Date(),
          },
        }),
      ]);

      await this.audit.record({
        actorId: phoneTaken.id,
        action: 'invite.complete_existing_client',
        entity: 'Invite',
        entityId: invite.id,
        tenantId: invite.tenantId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return { clientId: phoneTaken.clientId, linkedExisting: true };
    }

    const [firstName, ...rest] = dto.fullName.trim().split(/\s+/);
    const lastName = rest.join(' ');
    const passwordHash = await this.passwords.hash(dto.password);

    const clientId = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          // NRC/DOB/address stay null until the profile wizard completes.
          firstName: firstName ?? invite.clientName,
          lastName: lastName || invite.clientName,
          phone: invite.phone,
        },
      });

      await tx.user.create({
        data: {
          phone: invite.phone,
          passwordHash,
          displayName: dto.fullName.trim(),
          role: 'client',
          clientId: client.id,
        },
      });

      await tx.clientLenderLink.create({
        data: { clientId: client.id, tenantId: invite.tenantId },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: {
          status: 'completed',
          clientId: client.id,
          completedAt: new Date(),
        },
      });

      return client.id;
    });

    await this.audit.record({
      actorId: clientId,
      action: 'invite.complete_account_created',
      entity: 'Client',
      entityId: clientId,
      tenantId: invite.tenantId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      diff: { consent: dto.consent },
    });

    return { clientId, linkedExisting: false };
  }

  /** Lender-side list for the invites screen. */
  async listForTenant(tenantId: string, status?: string) {
    const rows = await this.prisma.invite.findMany({
      where: { tenantId, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        clientId: r.clientId,
        clientName: r.clientName,
        phone: r.phone,
        status: r.status,
        expiresAt: r.expiresAt,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
      })),
    };
  }

  private hashToken(raw: string): string {
    // Codes are normalised (uppercase, separators stripped) so a client who
    // types "kmv-7xq4p" or "KMV7XQ4P" still matches.
    const normalized = raw.trim().toUpperCase().replace(/[\s-]/g, '');
    return createHash('sha256').update(normalized).digest('hex');
  }

  /** Collision-checked against other PENDING invites. */
  private async newCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let body = '';
      for (let i = 0; i < CODE_BODY_LEN; i++) {
        body += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
      }
      const code = `KMV-${body}`;
      const clash = await this.prisma.invite.findFirst({
        where: { tokenHash: this.hashToken(code), status: 'pending' },
        select: { id: true },
      });
      if (!clash) return code;
    }
    throw new Error('Unable to allocate a unique invite code');
  }

  /** Only ever show the last 4 digits on a public lookup. */
  private maskPhone(phone: string): string {
    return phone.length >= 4 ? `••••• ${phone.slice(-4)}` : phone;
  }

  private normalize(raw: string): string {
    const phone = normalizeZmPhone(raw);
    if (!phone) throw new BadRequestException('Invalid Zambian phone number');
    return phone;
  }
}
