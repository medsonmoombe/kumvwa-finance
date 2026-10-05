-- Split the single "PlatformTerms" document into versioned legal documents.
--
-- Existing rows are terms by definition: the column did not exist before, so
-- every stored body is the Terms of Service. DEFAULT 'terms' backfills them in
-- place, which keeps the rows (and therefore any existing acceptance's
-- platformVersion pointer) valid.
CREATE TYPE "LegalDocumentKind" AS ENUM ('terms', 'privacy');

ALTER TABLE "PlatformTerms"
  ADD COLUMN "kind" "LegalDocumentKind" NOT NULL DEFAULT 'terms';

-- `version @unique` meant terms and privacy could never both exist at v1.
DROP INDEX "PlatformTerms_version_key";

CREATE UNIQUE INDEX "PlatformTerms_kind_version_key"
  ON "PlatformTerms"("kind", "version");

CREATE INDEX "PlatformTerms_kind_version_idx"
  ON "PlatformTerms"("kind", "version");