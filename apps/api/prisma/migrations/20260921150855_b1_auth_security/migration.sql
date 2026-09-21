/*
  Warnings:

  - Added the required column `sessionId` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "sessionId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");

-- ── AuditLog immutability: trigger blocks UPDATE/DELETE regardless of role ──
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditlog_no_mutation
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- ── Row-Level Security on tenant-scoped tables (defense-in-depth) ──
-- The API connects as the table owner (bypasses RLS); these policies enforce
-- isolation for any OTHER role (BI tools, support read-replicas, future
-- non-owner connections). Unset app.tenant_id ⇒ sees nothing (default-deny).

ALTER TABLE "Loan"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Repayment"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoanProduct"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoanRequest"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invite"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditCheck"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "File"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientLenderLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Installment"   ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Loan"
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "Repayment"
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "LoanProduct"
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "LoanRequest"
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "Invite"
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "CreditCheck"
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "File"
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "ClientLenderLink"
  USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "Installment"
  USING (EXISTS (
    SELECT 1 FROM "Loan" l
    WHERE l."id" = "Installment"."loanId"
      AND l."tenantId" = current_setting('app.tenant_id', true)
  ));
