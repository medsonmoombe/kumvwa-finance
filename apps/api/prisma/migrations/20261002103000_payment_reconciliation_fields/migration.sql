-- Reconciliation bookkeeping for in-flight money movement.
--
-- PaymentIntent.reconcileAttempts caps how many times the API's sweep re-asks
-- the provider about a charge that never settled. Without a cap, an
-- unanswerable charge is polled every 30s forever; with one, it is left
-- untouched for a human to resolve. Note this bounds RETRIES ONLY — it never
-- force-fails a charge, because a real payment in flight must not be marked
-- as lost.
--
-- Payout.failureReason records the worker's "unresolved past the settlement
-- window" escalation. It is deliberately a note and not a status change: no
-- PaymentStatus means "we don't know", and inventing one would let an
-- unresolved disbursement be mistaken for a settled or failed payment.

-- AlterTable
ALTER TABLE "PaymentIntent" ADD COLUMN     "reconcileAttempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "failureReason" TEXT;
