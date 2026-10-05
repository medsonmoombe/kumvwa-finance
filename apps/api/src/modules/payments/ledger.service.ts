import { Injectable } from '@nestjs/common';
import type { LedgerAccount } from '@prisma/client';

import { PrismaService } from '../../infra/prisma.module';

export interface LedgerEntry {
  entryType: string; // charge | disbursement | refund | fee | adjustment
  account: LedgerAccount;
  direction: 'debit' | 'credit';
  amountMinor: bigint;
  providerRef?: string | null;
  rawPayload?: unknown;
}

/**
 * Append-only ledger. Every settled intent writes balanced lines here so the
 * money trail is reconstructable independently of the domain rows. Rows are
 * never updated or deleted.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async post(intentId: string, entries: LedgerEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.prisma.paymentTransaction.createMany({
      data: entries.map((e) => ({
        intentId,
        entryType: e.entryType,
        account: e.account,
        direction: e.direction,
        amountMinor: e.amountMinor,
        providerRef: e.providerRef ?? null,
        rawPayload: (e.rawPayload as object | undefined) ?? undefined,
      })),
    });
  }

  forIntent(intentId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: { intentId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
