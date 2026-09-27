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

    for (const loan of loans) {
      if (loan.status === 'cleared') loansCleared++;
      for (const inst of loan.installments) {
        if (inst.status === 'paid' && inst.paidAt) {
          // On time means settled by the end of the ZAMBIAN day it fell due -
          // 22:00 UTC, not midnight UTC.
          if (inst.paidAt <= endOfBusinessDay(inst.dueDate)) {
            installmentsPaidOnTime++;
          } else {
            installmentsLate++;
          }
        } else if (inst.status === 'overdue') {
          installmentsLate++;
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
