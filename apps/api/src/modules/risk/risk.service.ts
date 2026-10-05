import { Inject, Injectable } from '@nestjs/common';
import {
  bandFromScore,
  businessDate,
  creditLimitKwacha,
  daysBetween,
  endOfBusinessDay,
  internalScore,
} from '@kumvwa/core';
import type { RepaymentHistory } from '@kumvwa/core';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma.module';

/**
 * Risk profile = the platform's own repayment signal (bureau adapters plug
 * into the same shape later). In the real system the score is refreshed by a
 * job; here it is derived on demand from the client's loan history.
 */
@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Repayment behaviour facts behind the score. */
  async history(clientId: string): Promise<RepaymentHistory> {
    const loans = await this.prisma.loan.findMany({
      where: { clientId },
      include: { installments: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = businessDate();
    let installmentsPaidOnTime = 0;
    let installmentsLate = 0;
    let daysOverdueWorst = 0;
    let loansCleared = 0;
    // Money still owed, and money ever billed, so lateness can be weighted by
    // how much is actually outstanding rather than by installment count alone.
    let arrearsMinor = 0n;
    let billedMinor = 0n;

    for (const loan of loans) {
      if (loan.status === 'cleared') loansCleared++;
      for (const inst of loan.installments) {
        // Money, not the status flag, decides whether an installment is
        // settled: the overdue worker flips status on its own tick, so between
        // a due date passing and that tick a genuinely late installment is
        // still `pending` and used to be counted in NEITHER bucket — which
        // scored a defaulting borrower as clean.
        const unpaid = inst.amount - inst.paidAmount;
        const settled = inst.status === 'paid' && unpaid <= 0n;
        const pastDue = inst.dueDate < now;

        billedMinor += inst.amount;

        if (settled) {
          // On time means settled by the end of the ZAMBIAN day it fell due -
          // 22:00 UTC, not midnight UTC.
          if (inst.paidAt && inst.paidAt <= endOfBusinessDay(inst.dueDate)) {
            installmentsPaidOnTime++;
          } else {
            installmentsLate++;
          }
        } else if (pastDue) {
          installmentsLate++;
          arrearsMinor += unpaid > 0n ? unpaid : 0n;
          const days = daysBetween(inst.dueDate, now);
          if (days > daysOverdueWorst) daysOverdueWorst = days;
        }
      }
    }

    return {
      loansTotal: loans.length,
      loansCleared,
      installmentsPaidOnTime,
      installmentsLate,
      daysOverdueWorst,
      arrearsShare: ratio(arrearsMinor, billedMinor),
    };
  }

  /** Shared computation: internal score + band + kwacha limit. */
  async computeProfile(clientId: string) {
    const score = internalScore(await this.history(clientId));
    return {
      score,
      band: score === null ? null : bandFromScore(score),
      limitKwacha: creditLimitKwacha(
        score,
        this.env.CREDIT_LIMIT_NO_HISTORY_KWACHA,
      ),
      source: 'internal' as const,
    };
  }
}

/** Precision of the arrears ratio — enough to be stable, cheap to compute. */
const RATIO_SCALE = 1000n;

/**
 * `part / whole` as a 0–1 number, computed in integer space so large ngwee
 * amounts never lose precision to float rounding.
 */
function ratio(part: bigint, whole: bigint): number {
  if (whole <= 0n || part <= 0n) return 0;
  const scaled = (part * RATIO_SCALE) / whole;
  return Number(scaled) / Number(RATIO_SCALE);
}
