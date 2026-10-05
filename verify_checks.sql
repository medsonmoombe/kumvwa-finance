\echo == Loan #28: created 2026-09-27 09:22 UTC ==
SELECT
  l."loanRef",
  l."createdAt",
  l."disbursedAt",
  EXTRACT(EPOCH FROM (l."createdAt" AT TIME ZONE 'Africa/Lusaka'))::bigint / 86400 AS zambian_day,
  i.seq,
  i."dueDate",
  i.amount,
  i."paidAmount",
  i."interestMinor",
  (i."dueDate" AT TIME ZONE 'Africa/Lusaka')::date AS zambian_due
FROM "Loan" l
LEFT JOIN "Installment" i ON i."loanId" = l.id
WHERE l."loanRef" IN ('LN-2026-00027', 'LN-2026-00028', 'LN-2026-00029')
ORDER BY l."createdAt", i.seq;

\echo == Any loan whose first installment dueDate disagrees with (Zambian drawdown + 1 period)? ==
-- Only testable for monthly repayments created via approval path (disbursedAt present).
-- If the schedule used UTC disbursement, the first due would be one day early on evening local draws.
SELECT
  l."loanRef",
  EXTRACT(EPOCH FROM (l."createdAt" AT TIME ZONE 'Africa/Lusaka'))::bigint / 86400 AS zambian_draw_day,
  -- expected first due = one month after the zambian day of drawdown (monthly)
  (DATE '1970-01-01' + (EXTRACT(EPOCH FROM (l."createdAt" AT TIME ZONE 'Africa/Lusaka'))::bigint / 86400) * INTERVAL '1 day' + INTERVAL '1 month')::date AS expected_first_due_zambian
FROM "Loan" l
WHERE l."createdAt" >= '2026-09-22'
ORDER BY l."createdAt"
LIMIT 40;
