-- Preserve the outcome of a business-verification decision for the review page.
ALTER TABLE "Tenant"
  ADD COLUMN "verificationReviewedAt" TIMESTAMP(3),
  ADD COLUMN "verificationReviewedBy" TEXT;
