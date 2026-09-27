import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.module';
import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { minorToKwacha } from '@kumvwa/core';
import type { UpdateProfileDto } from './dto/clients.dto';

/** Which face of the NRC a viewer asked for. Anything else means 'front'. */
export type NrcSide = 'front' | 'back';

export function parseNrcSide(value?: string): NrcSide {
  return value === 'back' ? 'back' : 'front';
}

export function clientProfileStatus(client: {
  firstName: string;
  lastName: string;
  nrcHash: string | null;
  dob: Date | null;
  address: string | null;
}) {
  let percent = 40; // fullName + phone are minted at invite time
  if (client.nrcHash) percent += 20;
  if (client.dob) percent += 20;
  if (client.address && client.address.trim().length > 0) percent += 20;
  return {
    profileComplete: percent >= 100,
    profilePercent: Math.min(percent, 100),
    missing: [
      ...(!client.nrcHash ? ['nrc'] : []),
      ...(!client.dob ? ['dob'] : []),
      ...(!client.address || client.address.trim().length === 0
        ? ['address']
        : []),
    ],
  };
}

/**
 * The stepper's required fields, in the order the form asks for them. This is
 * the single source of truth for "is this borrower registered?" — both the
 * completion flag written by `submitProfile` and the gate the app renders are
 * derived from it, so the two can never drift apart.
 */
export const REGISTRATION_FIELDS = [
  'email',
  'employmentStatus',
  'incomeSource',
  'educationLevel',
  'incomeBand',
  'kinName',
  'kinPhone',
] as const;

export type RegistrationField = (typeof REGISTRATION_FIELDS)[number];

/**
 * Every required registration field the borrower has not provided yet. Runs on
 * the MERGED record (stored values overlaid with the submitted body) so a
 * partial save of one step never reports fields the client filled earlier as
 * missing.
 */
export function missingRegistrationFields(client: {
  email: string | null;
  employmentStatus: string | null;
  incomeSource: string | null;
  educationLevel: string | null;
  incomeBand: string | null;
  kinName: string | null;
  kinPhone: string | null;
}): RegistrationField[] {
  const blank = (value: string | null) =>
    value === null || String(value).trim().length === 0;

  return REGISTRATION_FIELDS.filter((field) =>
    // Mirrors the stepper: only a formally employed borrower must name their
    // employment sector, so `incomeSource` is otherwise not required.
    field === 'incomeSource'
      ? client.employmentStatus === 'formal_employment' &&
        blank(client.incomeSource)
      : blank(client[field]),
  );
}

export type RegistrationGateAction =
  /** Nothing outstanding — the borrower is free to use the app. */
  | 'complete'
  /** Required fields missing and no debt: bind them to the stepper. */
  | 'complete_registration'
  /**
   * Required fields missing BUT a loan still awaits repayment. Blocking here
   * would trap the borrower away from the only screen that can clear the debt,
   * so they are let in to settle it first and bound to the stepper afterwards.
   */
  | 'clear_loan_then_register';

/**
 * Decides how the app should treat a borrower: let them in, bind them to the
 * registration stepper, or let them clear an outstanding loan first and then
 * bind them. Pure — the caller supplies the merged profile and the open loans.
 */
export function evaluateRegistrationGate(
  missing: readonly RegistrationField[],
  openOutstanding: readonly bigint[],
): {
  action: RegistrationGateAction;
  missing: RegistrationField[];
  openLoanCount: number;
  openTotalOutstanding: bigint;
} {
  const openLoanCount = openOutstanding.length;
  const openTotalOutstanding = openOutstanding.reduce(
    (sum, amount) => sum + amount,
    0n,
  );

  if (missing.length === 0) {
    return {
      action: 'complete',
      missing: [],
      openLoanCount,
      openTotalOutstanding,
    };
  }

  return {
    action:
      openLoanCount > 0 ? 'clear_loan_then_register' : 'complete_registration',
    missing: [...missing],
    openLoanCount,
    openTotalOutstanding,
  };
}

/**
 * Client-facing self-service reads. Clients NEVER receive tenant-scoped
 * data beyond the lender contact/list they are linked to.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nrc: NrcCryptoService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
  ) {}

  async me(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { user: { select: { phone: true, status: true } } },
    });
    if (!client) throw new NotFoundException('Client not found');

    // Loans that still owe money. `cleared` is excluded by definition; a
    // defaulted-but-unpaid loan still counts, because the borrower still has
    // to settle it before registration is worth anything to a lender.
    const openLoans = await this.prisma.loan.findMany({
      where: { clientId, status: { not: 'cleared' } },
      select: { totalDue: true, paidAmount: true },
    });
    const openOutstanding = openLoans
      .map((l) => (l.totalDue > l.paidAmount ? l.totalDue - l.paidAmount : 0n))
      .filter((amount) => amount > 0n);

    const registration = evaluateRegistrationGate(
      missingRegistrationFields(client),
      openOutstanding,
    );

    return {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      fullName: `${client.firstName} ${client.lastName}`.trim(),
      phone: client.phone,
      // NRC is PII: the API only ever emits a masked form (the stored value is
      // AES-GCM ciphertext; de-encryption is audited in the ops tooling).
      nrcMasked: client.nrcHash ? '••••••/••/•' : null,
      dob: client.dob,
      address: client.address,
      email: client.email,
      employmentStatus: client.employmentStatus,
      educationLevel: client.educationLevel,
      incomeBand: client.incomeBand,
      incomeSource: client.incomeSource,
      kinName: client.kinName,
      kinPhone: client.kinPhone,
      nrcPhotoFileId: client.nrcPhotoFileId,
      nrcBackPhotoFileId: client.nrcBackPhotoFileId,
      // The stepper's completion flag is separate from the KYC percentage.
      profileCompleted: client.profileCompletedAt !== null,
      status: client.status,
      userStatus: client.user?.status ?? null,
      // Authoritative post-login routing: which required fields are still
      // missing, and whether a loan must be cleared before the stepper binds.
      registration: {
        action: registration.action,
        missing: registration.missing,
        openLoanCount: registration.openLoanCount,
        openTotalOutstanding: minorToKwacha(registration.openTotalOutstanding),
      },
      ...clientProfileStatus(client),
      createdAt: client.createdAt,
    };
  }

  /**
   * Guards `clients/me` routes: confirms the token's clientId still exists
   * and returns it. A client can only ever act on their own row.
   */
  async assertSelf(clientId: string): Promise<string> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client.id;
  }

  /**
   * First-login profile stepper submission — stores the richer KYC fields
   * (employment, income, next of kin, NRC photos). The profile only counts as
   * COMPLETE once every field the stepper treats as required is present, so a
   * partial submission can't sneak a client past the gate into the app.
   */
  async submitProfile(clientId: string, dto: UpdateProfileDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!existing) throw new NotFoundException('Client not found');

    for (const [field, fileId] of [
      ['NRC front photo', dto.nrcPhotoFileId],
      ['NRC back photo', dto.nrcBackPhotoFileId],
    ] as const) {
      if (!fileId) continue;
      const f = await this.prisma.file.findUnique({ where: { id: fileId } });
      // `checksum` is stamped on /files/confirm — empty means never uploaded.
      if (
        !f ||
        f.kind !== 'nrc_photo' ||
        f.tenantId !== null ||
        f.checksum === ''
      ) {
        throw new BadRequestException(
          `${field} must be an uploaded nrc_photo file`,
        );
      }
    }

    // Completeness is judged on the MERGED record: a client who saved step 0
    // and comes back for step 2 has already stored employment/education/income,
    // and the fields omitted from this body must not read as missing.
    const requiredPresent =
      missingRegistrationFields({
        email,
        employmentStatus: dto.employmentStatus ?? existing.employmentStatus,
        incomeSource: dto.incomeSource ?? existing.incomeSource,
        educationLevel: dto.educationLevel ?? existing.educationLevel,
        incomeBand: dto.incomeBand ?? existing.incomeBand,
        kinName: dto.kinName ?? existing.kinName,
        kinPhone: dto.kinPhone ?? existing.kinPhone,
      }).length === 0;

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        email,
        employmentStatus: dto.employmentStatus as never,
        educationLevel: dto.educationLevel as never,
        incomeBand: dto.incomeBand as never,
        incomeSource: dto.incomeSource,
        kinName: dto.kinName,
        kinPhone: dto.kinPhone,
        nrcPhotoFileId: dto.nrcPhotoFileId,
        nrcBackPhotoFileId: dto.nrcBackPhotoFileId,
        // Never un-complete a profile that already got through the gate;
        // leave `undefined` so Prisma keeps the stored value.
        profileCompletedAt: requiredPresent ? new Date() : undefined,
      },
    });
    return { profileCompleted: updated.profileCompletedAt !== null };
  }

  /**
   * Post-login KYC wizard: the client supplies NRC / DOB / address. NRC is
   * validated, HMAC-deduped platform-wide, and stored as ciphertext. The
   * invite only minted the account — this call is what completes the profile.
   */
  async updateProfile(
    clientId: string,
    dto: { nrc?: string; dateOfBirth?: string; address?: string },
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    if (dto.nrc?.trim()) {
      const nrc = dto.nrc.trim();
      if (!/^\d{6}\/\d{2}\/\d$/.test(nrc)) {
        throw new BadRequestException('Enter a valid NRC (e.g. 245711/63/1)');
      }
      const nrcHash = this.nrc.hash(nrc);
      const clash = await this.prisma.client.findFirst({
        where: { nrcHash, NOT: { id: client.id } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException('This NRC is already registered');
      }
      await this.prisma.client.update({
        where: { id: client.id },
        data: {
          nrcHash,
          nrcEncrypted: this.nrc.encrypt(nrc),
          ...(dto.dateOfBirth ? { dob: new Date(dto.dateOfBirth) } : {}),
          ...(dto.address?.trim() ? { address: dto.address.trim() } : {}),
        },
      });
    } else {
      await this.prisma.client.update({
        where: { id: client.id },
        data: {
          ...(dto.dateOfBirth ? { dob: new Date(dto.dateOfBirth) } : {}),
          ...(dto.address?.trim() ? { address: dto.address.trim() } : {}),
        },
      });
    }

    return this.me(clientId);
  }

  /** Lenders the client can request from (linked via invite/past lending). */
  async lenders(clientId: string) {
    const links = await this.prisma.clientLenderLink.findMany({
      where: { clientId, tenant: { status: 'active' } },
      include: { tenant: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: links.map((l) => ({
        id: l.tenant.id,
        name: l.tenant.name,
        status: l.tenant.status,
        linkedAt: l.createdAt,
      })),
    };
  }

  /**
   * Lender view: full client detail — profile, loans, risk, override.
   * NRC photo access is audited per platform rule.
   */
  async getForTenant(tenantId: string, actorId: string, clientId: string) {
    const link = await this.prisma.clientLenderLink.findUnique({
      where: { clientId_tenantId: { clientId, tenantId } },
      include: { client: { include: { _count: { select: { lenderLinks: true } } } } },
    });
    if (!link) throw new NotFoundException('Client not found');

    const c = link.client;

    const [loans, risk, override] = await Promise.all([
      this.prisma.loan.findMany({
        where: { clientId, tenantId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, loanRef: true, status: true, principal: true, totalDue: true,
          paidAmount: true, createdAt: true,
          repayments: {
            select: { id: true, amount: true, method: true, reference: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.creditCheck.findFirst({
        where: { clientId, tenantId },
        orderBy: { checkedAt: 'desc' },
      }),
      this.prisma.clientLimitOverride.findFirst({
        where: { clientId, tenantId, active: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (c.nrcPhotoFileId) {
      await this.audit.record({
        actorId, action: 'pii.read', entity: 'Client', entityId: clientId,
        tenantId, diff: { field: 'nrcPhoto', context: 'lender.client_detail' },
      });
    }

    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      nrc: c.nrcEncrypted ? this.nrc.decrypt(c.nrcEncrypted) : null,
      phone: c.phone,
      email: c.email,
      dob: c.dob,
      address: c.address,
      employmentStatus: c.employmentStatus,
      incomeBand: c.incomeBand,
      incomeSource: c.incomeSource,
      kinName: c.kinName,
      kinPhone: c.kinPhone,
      nrcPhotoFileId: c.nrcPhotoFileId,
      nrcBackPhotoFileId: c.nrcBackPhotoFileId,
      lendersCount: c._count.lenderLinks,
      joinedAt: link.createdAt,
      loans: loans.map((l) => ({
        id: l.id, loanRef: l.loanRef, status: l.status, createdAt: l.createdAt,
        principal: minorToKwacha(l.principal),
        outstanding: minorToKwacha(l.totalDue - l.paidAmount > 0n ? l.totalDue - l.paidAmount : 0n),
      })),
      repayments: loans.flatMap((loan) =>
        loan.repayments.map((repayment) => ({
          id: repayment.id,
          loanId: loan.id,
          loanRef: loan.loanRef,
          amount: minorToKwacha(repayment.amount),
          method: repayment.method,
          reference: repayment.reference,
          recordedAt: repayment.createdAt,
        })),
      ).sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()),
      risk: risk ? { score: risk.score, band: risk.band, source: risk.source, checkedAt: risk.checkedAt } : null,
      limitOverride: override ? { limitKwacha: override.limitKwacha, reason: override.reason, grantedAt: override.createdAt } : null,
    };
  }

  /**
   * Lender view of a borrower's NRC. BOTH faces are retrievable — the front
   * alone cannot verify an identity match, and either may be missing (the
   * photos are optional), so each side 404s on its own. Reading someone
   * else's ID is a PII read → audited.
   */
  async getNrcPhotoUrl(
    tenantId: string,
    actorId: string,
    clientId: string,
    side: NrcSide = 'front',
  ) {
    const link = await this.prisma.clientLenderLink.findUnique({
      where: { clientId_tenantId: { clientId, tenantId } },
      include: {
        client: { select: { nrcPhotoFileId: true, nrcBackPhotoFileId: true } },
      },
    });
    const fileId =
      side === 'back'
        ? link?.client.nrcBackPhotoFileId
        : link?.client.nrcPhotoFileId;
    if (!fileId) throw new NotFoundException(`No NRC ${side} photo on file`);

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File missing');

    await this.audit.record({
      actorId, action: 'pii.read', entity: 'Client', entityId: clientId,
      tenantId, diff: { field: 'nrcPhoto', side, context: 'lender.nrc_viewer' },
    });
    return { url: await this.files.presignGet(file.storageKey, file.mime) };
  }

  /**
   * The borrower's OWN NRC photo — the only stored object a client may ever
   * read back. The profile IS the authorisation, so this needs no tenant
   * scope and can never reach a document somebody else uploaded. No audit
   * entry: it is their own ID, read by them.
   */
  async ownNrcPhotoUrl(clientId: string, side: NrcSide = 'front') {
    const c = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { nrcPhotoFileId: true, nrcBackPhotoFileId: true },
    });
    const fileId =
      side === 'back' ? c?.nrcBackPhotoFileId : c?.nrcPhotoFileId;
    if (!fileId) throw new NotFoundException(`No NRC ${side} photo on file`);

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File missing');

    return { url: await this.files.presignGet(file.storageKey, file.mime) };
  }

  /**
   * Lender view: every client linked to this tenant, newest link first.
   * `q` matches name or phone. NRC is deliberately NOT searchable — only its
   * HMAC is stored, and it is never emitted (masked, as in `me`).
   *
   * Loan counts are scoped to THIS tenant: a lender must not learn a client's
   * exposure at a competitor.
   */
  async listForTenant(tenantId: string, q?: string) {
    const term = q?.trim();

    const links = await this.prisma.clientLenderLink.findMany({
      where: {
        tenantId,
        ...(term
          ? {
              client: {
                OR: [
                  {
                    firstName: {
                      contains: term,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    lastName: {
                      contains: term,
                      mode: 'insensitive' as const,
                    },
                  },
                  { phone: { contains: term } },
                ],
              },
            }
          : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            nrcHash: true,
            status: true,
            createdAt: true,
            _count: { select: { lenderLinks: true } },
            loans: {
              where: { tenantId },
              select: { status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return {
      items: links.map((l) => ({
        id: l.client.id,
        name: `${l.client.firstName} ${l.client.lastName}`.trim(),
        phone: l.client.phone,
        nrcMasked: l.client.nrcHash ? '••••••/••/•' : null,
        status: l.client.status,
        // Platform-wide: how many lenders this client is linked to.
        lendersCount: l.client._count.lenderLinks,
        // This tenant's exposure only.
        activeLoans: l.client.loans.filter((x) => x.status === 'active').length,
        overdueLoans: l.client.loans.filter((x) => x.status === 'overdue')
          .length,
        totalLoans: l.client.loans.length,
        linkedAt: l.createdAt,
      })),
    };
  }
}
