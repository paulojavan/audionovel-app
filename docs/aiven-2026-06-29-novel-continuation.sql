-- Execute uma única vez no banco PostgreSQL do Aiven antes de publicar
-- a versão da aplicação que usa a relação de continuação entre novels.

BEGIN;

ALTER TABLE "Novel"
ADD COLUMN "continuationId" TEXT;

CREATE UNIQUE INDEX "Novel_continuationId_key"
ON "Novel"("continuationId");

ALTER TABLE "Novel"
ADD CONSTRAINT "Novel_continuationId_fkey"
FOREIGN KEY ("continuationId")
REFERENCES "Novel"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMIT;
