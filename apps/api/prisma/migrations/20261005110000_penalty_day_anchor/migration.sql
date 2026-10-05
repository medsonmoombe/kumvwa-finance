-- Give every pre-existing installment a penalty day anchor.
--
-- `lastPenaltyDate` arrived NULL on all existing rows. That null is ambiguous:
-- it could mean "never charged" or "the old worker already charged today before
-- we restarted" (the old in-memory guard could not survive a restart, so that
-- is genuinely possible). Reading it as "never charged" would double-charge
-- today's penalty; reading it as "charged since the due date" would
-- retroactively bill every day a loan has been late, which is not something a
-- schema migration should decide on a live book.
--
-- Anchoring to today's Zambian civil date picks the conservative option:
-- no retroactive charge, no duplicate charge, and normal daily accrual resumes
-- tomorrow. A NULL now unambiguously means "flipped overdue today, never
-- charged", which is exactly the first-accrual case the worker must handle.
UPDATE "Installment"
SET "lastPenaltyDate" = (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lusaka')::date
WHERE "lastPenaltyDate" IS NULL;