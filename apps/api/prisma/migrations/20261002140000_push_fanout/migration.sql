-- Push fan-out marker. The worker pushes each Notification to the recipient's
-- registered devices exactly once; in-app delivery is unaffected. Null means
-- "still owed a push".
ALTER TABLE "Notification" ADD COLUMN "pushedAt" TIMESTAMP(3);

-- Every row that predates this migration must NOT be pushed: without this, the
-- first worker tick would blast the entire historical notification table to
-- every device currently registered.
UPDATE "Notification" SET "pushedAt" = "createdAt" WHERE "pushedAt" IS NULL;

-- The worker scans `pushedAt IS NULL` ordered by age.
CREATE INDEX "Notification_pushedAt_createdAt_idx" ON "Notification"("pushedAt", "createdAt");

-- Fan-out resolves tokens per recipient.
CREATE INDEX "DevicePushToken_userId_idx" ON "DevicePushToken"("userId");