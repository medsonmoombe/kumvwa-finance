import { Injectable, NotFoundException } from '@nestjs/common';
import { minorToKwacha } from '@kumvwa/core';

import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';

/**
 * Zambia Data Protection Act 2021 rights, exercised by the data subject:
 *  - right of access  → a complete portable export of their own data
 *  - right to erasure → limited by lending law and by other parties' records
 */
@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nrc: NrcCryptoService,
    private readonly audit: AuditService,
  ) {}

  /** Right of access. Decrypting the subject's OWN NRC is legitimate here. */
  async exportMyData(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        lenderLinks: {
          include: { tenant: { select: { id: true, name: true } } },
        },
        loans: {
          include: {
            tenant: { select: { name: true } },
            installments: { orderBy: { seq: 'asc' } },
            repayments: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
        requests: {
          include: { tenant: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        creditChecks: {
          select: { source: true, score: true, band: true, checkedAt: true },
          orderBy: { checkedAt: 'desc' },
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');

    await this.audit.record({
      actorId: clientId,
      action: 'pii.export',
      entity: 'Client',
      entityId: clientId,
      diff: { scope: 'dpa_self_export', loanCount: client.loans.length },
    });

    return {
      format: 'kumvwa.dpa-export.v1',
      exportedAt: new Date().toISOString(),
      profile: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        dob: client.dob,
        address: client.address,
        status: client.status,
        // Null once anonymised (erasure wipes the ciphertext).
        nrc: client.nrcEncrypted
          ? this.nrc.decrypt(client.nrcEncrypted)
          : null,
        createdAt: client.createdAt,
      },
      lenders: client.lenderLinks.map((l) => ({
        id: l.tenant.id,
        name: l.tenant.name,
        linkedAt: l.createdAt,
      })),
      loans: client.loans.map((l) => ({
        id: l.id,
        lenderName: l.tenant.name,
        principal: minorToKwacha(l.principal),
        principalMinor: l.principal.toString(),
        totalDueMinor: l.totalDue.toString(),
        paidAmountMinor: l.paidAmount.toString(),
        status: l.status,
        disbursedAt: l.disbursedAt,
        installments: l.installments.map((i) => ({
          seq: i.seq,
          dueDate: i.dueDate,
          amountMinor: i.amount.toString(),
          paidMinor: i.paidAmount.toString(),
          status: i.status,
          paidAt: i.paidAt,
        })),
        repayments: l.repayments.map((r) => ({
          amountMinor: r.amount.toString(),
          method: r.method,
          reference: r.reference,
          at: r.createdAt,
        })),
      })),
      loanRequests: client.requests.map((r) => ({
        id: r.id,
        lenderName: r.tenant.name,
        amountMinor: r.amount.toString(),
        termCount: r.termCount,
        purpose: r.purpose,
        status: r.status,
        feedback: r.feedback,
        requestedAt: r.createdAt,
      })),
      creditChecks: client.creditChecks,
    };
  }

  /**
   * Right to erasure, bounded by lending reality: an open loan is a live
   * obligation and is retained. With no open loans the identity is
   * ANONYMISED rather than deleted — the loan/repayment history is the
   * lender's statutory book and must stay intact.
   */
  async requestDeletion(clientId: string) {
    const blocking = await this.prisma.loan.count({
      where: { clientId, status: { in: ['active', 'overdue'] } },
    });
    if (blocking > 0) {
      return {
        accepted: false as const,
        reason: 'active_loans' as const,
        activeLoans: blocking,
        message:
          'Your identity cannot be erased while a loan is outstanding. ' +
          'Settle your loans first, then request deletion again.',
      };
    }

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, user: { select: { id: true } } },
    });
    if (!client) throw new NotFoundException('Client not found');

    const now = new Date();
    const userId = client.user?.id;

    await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id: client.id },
        data: {
          firstName: 'Deleted',
          lastName: `User-${client.id.slice(-6)}`,
          // Ciphertext cleared; `nrcHash` is deliberately KEPT as the
          // one-way dedupe tombstone that blocks re-registration fraud.
          nrcEncrypted: '',
          phone: `deleted:${client.id}`, // frees the real number
          dob: null,
          address: null,
          status: 'blocked',
        },
      }),
      ...(userId
        ? [
            this.prisma.user.update({
              where: { id: userId },
              data: {
                status: 'disabled',
                displayName: 'Deleted user',
                phone: `deleted:${userId}`,
              },
            }),
            // Kill every live session — erasure must end access immediately.
            this.prisma.refreshToken.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: now },
            }),
          ]
        : []),
    ]);

    await this.audit.record({
      actorId: clientId,
      action: 'dpa.delete_request',
      entity: 'Client',
      entityId: clientId,
      diff: { anonymized: true, loansRetained: true },
    });

    return { accepted: true as const, anonymized: true as const };
  }
}
