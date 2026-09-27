-- M5: bullet repayment structure, friendly loan references, and the
-- per-tenant lending rules (credit ladder) + per-client limit overrides.

-- ── 1. Repayment structure ──────────────────────────────────────────────
ALTER TABLE "LoanProduct" ADD COLUMN "repaymentStructure" TEXT NOT NULL DEFAULT 'bullet';
ALTER TABLE "Loan" ADD COLUMN "repaymentStructure" TEXT NOT NULL DEFAULT 'installments';

-- Existing rows predate bullet: keep today's amortizing behavior exactly.
UPDATE "LoanProduct" SET "repaymentStructure" = 'installments';
UPDATE "Loan" SET "repaymentStructure" = 'installments';

-- ── 2. Friendly reference (LN-2026-00001) ───────────────────────────────
-- Added nullable first so populated rows can be backfilled, then locked.
ALTER TABLE "Loan" ADD COLUMN "loanRef" TEXT;
UPDATE "Loan" SET "loanRef" = "id";
ALTER TABLE "Loan" ALTER COLUMN "loanRef" SET NOT NULL;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loanRef_key" UNIQUE ("loanRef");

-- ── 3. Per-tenant credit ladder (versioned) ─────────────────────────────
CREATE TABLE "CreditPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "policy" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditPolicy_tenantId_key" ON "CreditPolicy"("tenantId");

ALTER TABLE "CreditPolicy" ADD CONSTRAINT "CreditPolicy_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. Audited per-client limit overrides ───────────────────────────────
CREATE TABLE "ClientLimitOverride" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "limitKwacha" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientLimitOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientLimitOverride_clientId_tenantId_idx" ON "ClientLimitOverride"("clientId", "tenantId");

ALTER TABLE "ClientLimitOverride" ADD CONSTRAINT "ClientLimitOverride_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientLimitOverride" ADD CONSTRAINT "ClientLimitOverride_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
