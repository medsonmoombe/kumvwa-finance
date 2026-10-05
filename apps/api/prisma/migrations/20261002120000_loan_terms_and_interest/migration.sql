-- Immutable loan terms: the agreement frozen at issuance (+ tamper hash).
ALTER TABLE "Loan" ADD COLUMN "termsSnapshot" JSONB;
ALTER TABLE "Loan" ADD COLUMN "termsHash" TEXT;

-- Interest accounting: interest baked into each installment, and the interest
-- component of each repayment (the ledger sum used for reporting).
ALTER TABLE "Installment" ADD COLUMN "interestMinor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Repayment" ADD COLUMN "interestMinor" BIGINT NOT NULL DEFAULT 0;

-- Reporting reads sum interest per tenant.
CREATE INDEX "Repayment_tenantId_interestMinor_idx" ON "Repayment"("tenantId", "interestMinor");
