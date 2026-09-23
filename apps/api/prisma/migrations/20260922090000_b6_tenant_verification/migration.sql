-- B6: BOZ verification state on the tenant.
-- `bozSubmittedAt` drives the "under review" screen and gates approval;
-- `verificationNote` carries the reviewer's rejection reason back to the owner.
-- `ownerNrcEncrypted` is AES-256-GCM ciphertext, readable only by platform_admin
-- (every decryption is audited as a pii.read).

-- AlterTable
ALTER TABLE "Tenant"
  ADD COLUMN "bozSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "verificationNote" TEXT,
  ADD COLUMN "ownerNrcEncrypted" TEXT;
