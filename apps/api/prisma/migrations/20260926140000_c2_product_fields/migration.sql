-- C2: human-facing product identifiers.
--   code        — the lender's own product code (e.g. PL-001); shown on the
--                 console list and reports, never enforced.
--   description — internal note for staff; clients never see it.
ALTER TABLE "LoanProduct" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "LoanProduct" ADD COLUMN IF NOT EXISTS "description" TEXT;
