-- Persist the penalty day anchor on the installment itself.
--
-- The overdue worker previously kept "the day I last accrued penalties" in a
-- module-level variable, so every worker restart re-charged that day and two
-- overlapping ticks could both read the same penalty and each write their own
-- total. Storing the anchor per row makes accrual idempotent and lets the
-- update be conditional on it.
ALTER TABLE "Installment"
  ADD COLUMN "lastPenaltyDate" DATE;

-- The penalty sweep scans for rows that have never been charged or were last
-- charged before today.
CREATE INDEX "Installment_lastPenaltyDate_idx"
  ON "Installment"("lastPenaltyDate");