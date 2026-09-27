-- Repair: rollover-appended installments that were booked twice.
--
-- Before the "born paid" fix, a rollover recorded the carry-over fee as a
-- repayment (loan.paidAmount += share) AND created the appended interest-only
-- installment as UNPAID. The fee was therefore counted as collected and as
-- debt simultaneously, so a fully repaid loan could read "cleared"
-- (totalDue - paidAmount = 0) while still showing installments as due — and
-- the client app offered a pay button on a settled loan.
--
-- Code fixes protect future rows; this repairs the rows already written.
--
-- Every row with seq > termCount was appended by a rollover, and every
-- rollover added its share to loan.paidAmount — so those rows are records of a
-- charge already collected and must be marked paid. Idempotent: re-running
-- matches nothing once the rows agree.
UPDATE "Installment" i
SET
  "paidAmount" = i.amount,
  status = 'paid',
  "paidAt" = COALESCE(i."paidAt", NOW())
FROM "Loan" l
WHERE i."loanId" = l.id
  AND i.seq > l."termCount"
  AND i."paidAmount" < i.amount;

-- Verify afterwards — all four columns must agree per loan:
--
--   SELECT l.id,
--          (SELECT SUM(amount)       FROM "Installment" WHERE "loanId" = l.id) AS sum_amounts,
--          (SELECT SUM("paidAmount")  FROM "Installment" WHERE "loanId" = l.id) AS sum_paid,
--          l."totalDue",
--          l."paidAmount"
--   FROM "Loan" l
--   WHERE l."rolloverCount" > 0;
--
--   sum_amounts = l."totalDue"  AND  sum_paid = l."paidAmount"
