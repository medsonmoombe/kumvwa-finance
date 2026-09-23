import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.module';
import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import type { UpdateProfileDto } from './dto/clients.dto';

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
 * Client-facing self-service reads. Clients NEVER receive tenant-scoped
 * data beyond the lender contact/list they are linked to.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nrc: NrcCryptoService,
  ) {}

  async me(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { user: { select: { phone: true, status: true } } },
    });
    if (!client) throw new NotFoundException('Client not found');

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
      incomeBand: client.incomeBand,
      incomeSource: client.incomeSource,
      kinName: client.kinName,
      kinPhone: client.kinPhone,
      nrcPhotoFileId: client.nrcPhotoFileId,
      // The stepper's completion flag is separate from the KYC percentage.
      profileCompleted: client.profileCompletedAt !== null,
      status: client.status,
      userStatus: client.user?.status ?? null,
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
   * First-login profile stepper submission — marks the profile complete and
   * stores the richer KYC fields (employment, income, next of kin, NRC photo).
   */
  async submitProfile(clientId: string, dto: UpdateProfileDto) {
    const email = dto.email.toLowerCase();
    const dup = await this.prisma.client.findFirst({
      where: { email, NOT: { id: clientId } },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException('Email is already linked to another borrower');
    }

    if (dto.nrcPhotoFileId) {
      const f = await this.prisma.file.findUnique({
        where: { id: dto.nrcPhotoFileId },
      });
      // `checksum` is stamped on /files/confirm — empty means never uploaded.
      if (
        !f ||
        f.kind !== 'nrc_photo' ||
        f.tenantId !== null ||
        f.checksum === ''
      ) {
        throw new BadRequestException('NRC photo must be an uploaded nrc_photo file');
      }
    }

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        email,
        employmentStatus: dto.employmentStatus as never,
        incomeBand: dto.incomeBand as never,
        incomeSource: dto.incomeSource,
        kinName: dto.kinName,
        kinPhone: dto.kinPhone,
        nrcPhotoFileId: dto.nrcPhotoFileId,
        profileCompletedAt: new Date(),
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
      where: { clientId },
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
