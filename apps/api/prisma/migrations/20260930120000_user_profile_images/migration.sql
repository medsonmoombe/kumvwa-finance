ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'profile_image';

ALTER TABLE "User" ADD COLUMN "profileFileId" TEXT;
ALTER TABLE "File" ADD COLUMN "uploadedById" TEXT;

CREATE UNIQUE INDEX "User_profileFileId_key" ON "User"("profileFileId");
CREATE INDEX "File_uploadedById_idx" ON "File"("uploadedById");

ALTER TABLE "User"
  ADD CONSTRAINT "User_profileFileId_fkey"
  FOREIGN KEY ("profileFileId") REFERENCES "File"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "File"
  ADD CONSTRAINT "File_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
