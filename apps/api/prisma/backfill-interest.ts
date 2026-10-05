/**
 * One-off data repair: backfill interest accounting for loans issued BEFORE the
 * `20261002120000_loan_terms_and_interest` migration.
 *
 * That migration added `Installment.interestMinor` and `Repayment.interestMinor`
 * with `DEFAULT 0` but did NOT backfill the rows that already existed. Every
 * repayment recorded against a pre-existing installment therefore booked 0
 * interest, so `/reports/summary`'s `interestCollectedMinor` — which sums
 * `Repayment.interestMinor` — stayed at 0 while `interestContractedMinor`
 * (computed live from `totalDue − principal − fee`) showed a healthy number.
 *
 * Recomputes both columns from the loan's own terms:
 *
 *   • `Installment.interestMinor` — the flat interest (`totalDue − principal −
 *     fee`) spread over the ORIGINAL installments in proportion to their size.
 *     A rollover-appended extension row (seq > termCount) is interest in full.
 *
 *   • `Repayment.interestMinor` — the interest recognised on the schedule so
 *     far (`Σ interestPaidOnInstallment`), the same figure the loan detail
 *     exposes as `interestPaidMinor`. Only the per-loan SUM is load-bearing
 *     (`Repayment.interestMinor` is never surfaced on a receipt or API row), so
 *     the split across the loan's repayments only has to add up; it is done in
 *     proportion to each repayment's size.
 *
 * Safe to re-run: every value is recomputed from repayment amounts and the
 * loan's terms, never from the (possibly zero) current column.
 *
 * Run: pnpm --filter @kumvwa/api prisma:backfill-interest
 */
import { PrismaClient } from '@prisma/client';
import {
  distributeInterest,
  interestPaidOnInstallment,
  nominalInterestMinor,
} from '@kumvwa/core';

const prisma = new PrismaClient();

/** Split `total` across `parts` in proportion to size; the last row absorbs rounding. */
function distributeProportionally(total: bigint, parts: readonly bigint[]): bigint[] {
  const n = parts.length;
  if (n === 0) return [];
  const sum = parts.reduce((s, a) => s + (a > 0n ? a : 0n), 0n);
  if (sum <= 0n || total <= 0n) return parts.map(() => 0n);
  const out: bigint[] = [];
  let allocated = 0n;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const amount = parts[i]! > 0n ? parts[i]! : 0n;
    const share = isLast ? total - allocated : (total * amount) / sum;
    out.push(share);
    allocated += share;
  }
  return out;
}

async function main() {
  const loans = await prisma.loan.findMany({
    include: {
      installments: { orderBy: { seq: 'asc' } },
      repayments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });

  let installmentsTouched = 0;
  let repaymentsTouched = 0;

  for (const loan of loans) {
    const originals = loan.installments.filter((i) => i.seq <= loan.termCount);
    if (originals.length === 0) continue;
    const extensions = loan.installments.filter((i) => i.seq > loan.termCount);

    // ── Installment split ──
    // Rollover-appended rows are pure interest; the rest of the flat interest
    // is spread over the ORIGINAL plan. A bullet loan has no appended rows, so
    // all of its (possibly rollover-grown) interest lands on the single row.
    const contracted = nominalInterestMinor(loan.totalDue, loan.principal, loan.feeMinor);
    const extensionInterest = extensions.reduce((s, i) => s + i.amount, 0n);
    const distributable =
      contracted > extensionInterest ? contracted - extensionInterest : 0n;
    const parts = distributeInterest(
      originals.map((i) => i.amount),
      distributable,
    );

    const interestById = new Map<string, bigint>();
    originals.forEach((i, idx) => interestById.set(i.id, parts[idx] ?? 0n));
    for (const i of extensions) interestById.set(i.id, i.amount);

    for (const inst of loan.installments) {
      const target = interestById.get(inst.id) ?? 0n;
      if (inst.interestMinor !== target) {
        await prisma.installment.update({
          where: { id: inst.id },
          data: { interestMinor: target },
        });
        installmentsTouched++;
      }
    }

    // ── Interest actually collected on this loan ──
    // Cumulative schedule recognition — matches the running value that
    // `LoansService.recordRepayment` books into each new repayment's ledger.
    let collected = 0n;
    for (const inst of loan.installments) {
      collected += interestPaidOnInstallment(
        interestById.get(inst.id) ?? 0n,
        inst.paidAmount,
        inst.amount,
      );
    }

    if (loan.repayments.length === 0) continue;

    // ── Write the repayment ledger ──
    // Only the per-loan SUM is read by reports, so spread `collected` across
    // the loan's repayments in proportion to size (last row absorbs rounding).
    const shares = distributeProportionally(
      collected,
      loan.repayments.map((r) => r.amount),
    );
    for (let i = 0; i < loan.repayments.length; i++) {
      const rep = loan.repayments[i]!;
      const target = shares[i]! < 0n ? 0n : shares[i]!;
      if (rep.interestMinor !== target) {
        await prisma.repayment.update({
          where: { id: rep.id },
          data: { interestMinor: target },
        });
        repaymentsTouched++;
      }
    }
  }

  const total = await prisma.repayment.aggregate({ _sum: { interestMinor: true } });
  console.log(`✓ installments updated: ${installmentsTouched}`);
  console.log(`✓ repayments updated:   ${repaymentsTouched}`);
  console.log(
    `✓ interest collected across the platform: ${(total._sum.interestMinor ?? 0n).toString()} ngwee`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
