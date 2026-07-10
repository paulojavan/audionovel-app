import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "prisma/aiven-2026-07-10-favorite-chapter-notifications.sql";
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

test("schema persists first publication and generic novel notification keys", () => {
  assert.match(schema, /publishedAt\s+DateTime\?/);
  assert.match(schema, /novelId\s+String\?/);
  assert.match(schema, /eventKey\s+String\?/);
  assert.match(schema, /@@unique\(\[userId, type, eventKey\]\)/);
  assert.match(schema, /novel\s+Novel\?\s+@relation\(fields: \[novelId\], references: \[id\], onDelete: Cascade\)/);
});

test("Aiven migration backfills published chapters and adds deduplication", () => {
  assert.ok(existsSync(migrationPath), "Aiven migration is required");
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /ADD COLUMN "publishedAt" TIMESTAMP\(3\)/);
  assert.match(migration, /SET "publishedAt" = "createdAt"/);
  assert.match(migration, /WHERE "published" = TRUE/);
  assert.match(migration, /ADD COLUMN "novelId" TEXT/);
  assert.match(migration, /ADD COLUMN "eventKey" TEXT/);
  assert.match(migration, /FOREIGN KEY \("novelId"\) REFERENCES "Novel"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.match(migration, /CREATE UNIQUE INDEX "Notification_userId_type_eventKey_key"/);
  assert.match(migration, /^COMMIT;/m);
});
