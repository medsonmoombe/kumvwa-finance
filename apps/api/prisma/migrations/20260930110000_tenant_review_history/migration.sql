CREATE TABLE "TenantReviewEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "changes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TenantReviewEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TenantReviewEvent"
  ADD CONSTRAINT "TenantReviewEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantReviewEvent"
  ADD CONSTRAINT "TenantReviewEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TenantReviewEvent_tenantId_createdAt_idx"
  ON "TenantReviewEvent"("tenantId", "createdAt");

CREATE INDEX "TenantReviewEvent_actorId_idx"
  ON "TenantReviewEvent"("actorId");
