import { PrismaClient } from '@prisma/client';
import { businessDate, nextPenalty } from '@kumvwa/core';

import { logger } from '../logger';

const prisma = new PrismaClient();

/**
 * Once-per-business-day gate for PENALTY accrual specifically. Status flipping
 * is idempotent and runs every tick; penalties must not, or a 15s tick would
 * accrue a day's penalty ~5760 times. In-memory gate: a worker restart before
 * the Zambian day rolls over could re-accrue one day - bounded by the product's cap.
 */
let lastPenaltyDay = '';

export async function processOverdue(): Promise<void> {
  // "Today" is the Zambian civil day, not the UTC one: between 22:00 and 24:00
  // UTC it is already tomorrow in Lusaka, and an installment due on the 27th
  // must not flip to overdue until the 28th actually begins locally.
  const today = businessDate();

  // 1. Past-due pending installments become overdue (idempotent).
  const flipped = await prisma.installment.updateMany({
    where: { status: 'pending', dueDate: { lt: today } },
    data: { status: 'overdue' },
  });

  // 2. Loans carrying an overdue installment are flagged overdue.
  const loansFlipped = await prisma.loan.updateMany({
    where: {
      status: 'active',
      installments: { some: { status: 'overdue' } },
    },
    data: { status: 'overdue' },
  });

  // 3. Penalty accrual - per-product opt-in, capped, once per business day.
  let accruedCount = 0;
  const dayKey = today.toISOString().slice(0, 10);
  if (dayKey !== lastPenaltyDay) {
    const stale = await prisma.installment.findMany({
      where: { status: 'overdue' },
      include: { loan: { include: { product: true } } },
      orderBy: { dueDate: 'asc' },
      take: 500,
    });

    for (const inst of stale) {
      const product = inst.loan.product;
      if (!product || product.penaltyBpsPerDay <= 0) continue;
      const unpaid = inst.amount - inst.paidAmount;
      if (unpaid <= 0n) continue;

      const accrued = nextPenalty({
        currentMinor: inst.penaltyMinor,
        unpaidMinor: unpaid,
        installmentAmountMinor: inst.amount,
        terms: {
          bpsPerDay: product.penaltyBpsPerDay,
          capBps: product.penaltyCapBps,
        },
      });
      if (accrued > 0n) {
        await prisma.installment.update({
          where: { id: inst.id },
          data: { penaltyMinor: inst.penaltyMinor + accrued },
        });
        accruedCount++;
      }
    }
    lastPenaltyDay = dayKey;
  }

  if (flipped.count > 0 || loansFlipped.count > 0 || accruedCount > 0) {
    logger.info(
      `overdue: ${flipped.count} installments + ${loansFlipped.count} loans flipped, ` +
        `${accruedCount} penalties accrued`,
    );
  }
}
