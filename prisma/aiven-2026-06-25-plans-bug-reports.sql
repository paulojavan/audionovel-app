ALTER TABLE "SubscriptionPlan"
ADD COLUMN IF NOT EXISTS "premiumDays" INTEGER NOT NULL DEFAULT 30;

UPDATE "SubscriptionPlan"
SET "premiumDays" = 365
WHERE "interval" = 'year'
  AND "premiumDays" = 30;

CREATE TABLE IF NOT EXISTS "BugReport" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "pageUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BugReport"
DROP CONSTRAINT IF EXISTS "BugReport_userId_fkey";

ALTER TABLE "BugReport"
ADD CONSTRAINT "BugReport_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "BugReport_userId_createdAt_idx" ON "BugReport"("userId", "createdAt");
