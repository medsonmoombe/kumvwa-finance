-- C4: platform-wide feature flags & killswitches
CREATE TABLE IF NOT EXISTS "PlatformConfig" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformConfig_key_key" ON "PlatformConfig"("key");
