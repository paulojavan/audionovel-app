BEGIN;

ALTER TABLE "BillingCheckoutIntent"
  ADD COLUMN IF NOT EXISTS "planName" TEXT,
  ADD COLUMN IF NOT EXISTS "amountCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "currency" TEXT;

UPDATE "BillingCheckoutIntent" AS intent
SET
  "planName" = plan."name",
  "amountCents" = plan."amountCents",
  "currency" = lower(plan."currency")
FROM "SubscriptionPlan" AS plan
WHERE intent."planId" = plan."id"
  AND (
    intent."planName" IS NULL
    OR intent."amountCents" IS NULL
    OR intent."currency" IS NULL
  );

-- Intenções antigas sem plano correspondente não podem ser validadas com segurança.
DELETE FROM "BillingCheckoutIntent"
WHERE "planName" IS NULL OR "amountCents" IS NULL OR "currency" IS NULL;

ALTER TABLE "BillingCheckoutIntent"
  ALTER COLUMN "planName" SET NOT NULL,
  ALTER COLUMN "amountCents" SET NOT NULL,
  ALTER COLUMN "currency" SET NOT NULL;

COMMIT;
