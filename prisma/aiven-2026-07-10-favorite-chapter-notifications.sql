BEGIN;

ALTER TABLE "Chapter"
  ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "Chapter"
SET "publishedAt" = "createdAt"
WHERE "published" = TRUE AND "publishedAt" IS NULL;

ALTER TABLE "Notification"
  ADD COLUMN "novelId" TEXT,
  ADD COLUMN "eventKey" TEXT;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_novelId_fkey"
  FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Notification_novelId_createdAt_idx"
  ON "Notification"("novelId", "createdAt");

CREATE UNIQUE INDEX "Notification_userId_type_eventKey_key"
  ON "Notification"("userId", "type", "eventKey");

COMMIT;
