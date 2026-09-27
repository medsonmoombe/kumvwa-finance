ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "OtpCode_userId_purpose_status_idx" ON "OtpCode"("userId", "purpose", "status");

CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Role_tenantId_name_key" ON "Role"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "Role_tenantId_idx" ON "Role"("tenantId");

CREATE TABLE IF NOT EXISTS "TrustedDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "label" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrustedDevice_tokenHash_key" ON "TrustedDevice"("tokenHash");
CREATE INDEX IF NOT EXISTS "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");

-- Existing lenders need the same immutable templates that new registrations
-- receive in AuthService. The unique tenant/name index makes this rerunnable.
INSERT INTO "Role" ("id", "tenantId", "name", "isSystem", "permissions", "createdAt", "updatedAt")
SELECT
  md5("Tenant"."id" || template."name" || clock_timestamp()::text),
  "Tenant"."id",
  template."name",
  true,
  template."permissions",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Tenant"
CROSS JOIN (
  VALUES
    ('Manager', ARRAY['clients.read','clients.invite','clients.override','loans.read','loans.issue','loans.approve','loans.reject','loans.repayment','loans.rollover','products.manage','policy.manage','terms.manage','branding.manage','reports.view','audit.view']::TEXT[]),
    ('Loan Officer', ARRAY['clients.read','clients.invite','loans.read','loans.approve','loans.reject','loans.repayment','reports.view']::TEXT[]),
    ('Teller', ARRAY['loans.read','loans.repayment']::TEXT[])
) AS template("name", "permissions")
ON CONFLICT ("tenantId", "name") DO NOTHING;

DO $$ BEGIN
  ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
