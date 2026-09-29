CREATE TABLE "MobileAccessCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "generatedBy" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MobileAccessCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MobileAccessCode_codeHash_key" ON "MobileAccessCode"("codeHash");
CREATE INDEX "MobileAccessCode_userId_expiresAt_idx" ON "MobileAccessCode"("userId", "expiresAt");
CREATE INDEX "MobileAccessCode_tenantId_createdAt_idx" ON "MobileAccessCode"("tenantId", "createdAt");
ALTER TABLE "MobileAccessCode" ADD CONSTRAINT "MobileAccessCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
