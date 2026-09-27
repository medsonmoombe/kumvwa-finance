-- M4 money maturity: fees, penalties, weekly cycles, rollover.
-- Hand-written to match `prisma migrate diff` output (DB was offline at
-- authoring time; verified against the schema datamodel).

-- LoanProduct: per-product money knobs
ALTER TABLE "LoanProduct" ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "LoanProduct" ADD COLUMN "originationFeeBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoanProduct" ADD COLUMN "feeTreatment" TEXT NOT NULL DEFAULT 'add';
ALTER TABLE "LoanProduct" ADD COLUMN "penaltyBpsPerDay" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoanProduct" ADD COLUMN "penaltyCapBps" INTEGER NOT NULL DEFAULT 2000;

-- Loan: schedule shape + fee + rollover bookkeeping
ALTER TABLE "Loan" ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "Loan" ADD COLUMN "feeMinor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Loan" ADD COLUMN "disbursementMinor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Loan" ADD COLUMN "rolloverCount" INTEGER NOT NULL DEFAULT 0;

-- Installment: accrued late penalty riding with the installment
ALTER TABLE "Installment" ADD COLUMN "penaltyMinor" BIGINT NOT NULL DEFAULT 0;
