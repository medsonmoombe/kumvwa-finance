-- M1: rich client profile (stepper), business info, white-label branding
-- (logo/color/name), two-layer versioned terms with audited acceptance, and
-- the EmailOutbox the worker drains for invite emails.

-- ── Enums ────────────────────────────────────────────────
ALTER TYPE "FileKind" ADD VALUE 'nrc_photo';
ALTER TYPE "FileKind" ADD VALUE 'tenant_logo';

CREATE TYPE "EmploymentStatus" AS ENUM ('formal_employment', 'self_employed', 'farming', 'informal', 'other');
CREATE TYPE "IncomeBand" AS ENUM ('b0_1000', 'b1001_3000', 'b3001_6000', 'b6000_plus');
CREATE TYPE "TermsScope" AS ENUM ('platform_business', 'platform_client', 'tenant');

-- ── Client profile stepper ───────────────────────────────
ALTER TABLE "Client"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "nrcPhotoFileId" TEXT,
  ADD COLUMN "employmentStatus" "EmploymentStatus",
  ADD COLUMN "incomeBand" "IncomeBand",
  ADD COLUMN "incomeSource" TEXT,
  ADD COLUMN "kinName" TEXT,
  ADD COLUMN "kinPhone" TEXT,
  ADD COLUMN "profileCompletedAt" TIMESTAMP(3);

-- ── Tenant business info + branding ──────────────────────
ALTER TABLE "Tenant"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "tpin" TEXT,
  ADD COLUMN "contactPerson" TEXT,
  ADD COLUMN "logoFileId" TEXT,
  ADD COLUMN "primaryColor" TEXT,
  ADD COLUMN "tagline" TEXT;

-- ── Platform terms (append-only version stream) ──────────
CREATE TABLE "PlatformTerms" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformTerms_pkey" PRIMARY KEY ("id")
);

-- ── Tenant (lender) terms ────────────────────────────────
CREATE TABLE "TenantTerms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantTerms_pkey" PRIMARY KEY ("id")
);

-- ── Terms acceptance audit ───────────────────────────────
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "clientId" TEXT,
    "scope" "TermsScope" NOT NULL,
    "tenantId" TEXT,
    "platformVersion" INTEGER,
    "tenantVersion" INTEGER,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- ── Email outbox ─────────────────────────────────────────
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "SmsStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ──────────────────────────────────────────────
CREATE UNIQUE INDEX "PlatformTerms_version_key" ON "PlatformTerms"("version");
CREATE UNIQUE INDEX "Tenant_logoFileId_key" ON "Tenant"("logoFileId");
CREATE UNIQUE INDEX "TenantTerms_tenantId_version_key" ON "TenantTerms"("tenantId", "version");
CREATE INDEX "TenantTerms_tenantId_idx" ON "TenantTerms"("tenantId");
CREATE INDEX "TermsAcceptance_actorId_scope_idx" ON "TermsAcceptance"("actorId", "scope");
CREATE INDEX "TermsAcceptance_clientId_scope_idx" ON "TermsAcceptance"("clientId", "scope");
CREATE INDEX "EmailOutbox_status_createdAt_idx" ON "EmailOutbox"("status", "createdAt");

-- ── Foreign keys ─────────────────────────────────────────
ALTER TABLE "TenantTerms" ADD CONSTRAINT "TenantTerms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
