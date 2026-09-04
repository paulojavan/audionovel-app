import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const adminForms = readFileSync("src/components/admin-content-forms.tsx", "utf8");
const aivenMigration = readFileSync(
  "prisma/aiven-2026-07-04-flexible-chapter-positions.sql",
  "utf8",
);
const flexibleVolumeMigration = readFileSync(
  "prisma/aiven-2026-09-04-flexible-volume-positions.sql",
  "utf8",
);

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);

  assert.notEqual(startIndex, -1, `Nao foi possivel localizar ${start}`);
  assert.notEqual(endIndex, -1, `Nao foi possivel localizar ${end}`);

  return source.slice(startIndex, endIndex);
}

function assertFlexibleChapterPositionInput(source: string, namePattern: string) {
  const input = source.match(new RegExp(`<input[^>]*name=${namePattern}[^>]*>`))?.[0];

  assert.ok(input, `Input de posicao ${namePattern} nao encontrado`);
  assert.match(input, /\btype="number"/);
  assert.match(input, /\bmin="0"/);
  assert.match(input, /\bstep="any"/);
}

test("Chapter e Volume persistem posicoes zero e decimais", () => {
  const volumeModel = sourceBetween(schema, "model Volume {", "model Chapter {");
  const chapterModel = sourceBetween(schema, "model Chapter {", "model ListeningProgress {");

  assert.match(volumeModel, /\bposition\s+Float\b/);
  assert.match(chapterModel, /\bposition\s+Float\b/);
  assert.match(chapterModel, /\bpositionEnd\s+Float\?/);
  assert.match(chapterModel, /@@unique\(\[volumeId, position\]\)/);
});

test("migracao Aiven converte a posicao de Volume para double precision", () => {
  assert.match(flexibleVolumeMigration, /^\s*BEGIN\s*;/m);
  assert.match(flexibleVolumeMigration, /^ALTER TABLE "Volume"$/m);
  assert.match(
    flexibleVolumeMigration,
    /ALTER COLUMN "position" TYPE DOUBLE PRECISION USING "position"::DOUBLE PRECISION/,
  );
  assert.match(flexibleVolumeMigration, /^\s*COMMIT\s*;/m);
});

test("migracao Aiven converte as posicoes de Chapter para double precision", () => {
  assert.match(aivenMigration, /^\s*BEGIN\s*;/m);
  assert.match(aivenMigration, /^ALTER TABLE "Chapter"$/m);
  assert.match(
    aivenMigration,
    /ALTER COLUMN "position" TYPE DOUBLE PRECISION USING "position"::DOUBLE PRECISION/,
  );
  assert.match(
    aivenMigration,
    /ALTER COLUMN "positionEnd" TYPE DOUBLE PRECISION USING "positionEnd"::DOUBLE PRECISION/,
  );
  assert.match(aivenMigration, /^\s*COMMIT\s*;/m);
});

test("inputs standalone e em bloco aceitam zero e decimais", () => {
  const editForm = sourceBetween(adminForms, "export function AdminChapterEditForm(", "export function AdminNovelForm(");
  const batchFields = sourceBetween(adminForms, "function ChapterBatchTable(", "function ChapterBlockFields(");
  const blockFields = sourceBetween(adminForms, "function ChapterBlockFields(", "function PublishFields(");

  assertFlexibleChapterPositionInput(editForm, '"position"');
  assertFlexibleChapterPositionInput(batchFields, "{`chapter\\.\\$\\{index\\}\\.position`}");
  assertFlexibleChapterPositionInput(blockFields, "{`chapter\\.\\$\\{index\\}\\.position`}");
});

test("input de posicao de volume aceita zero e decimais", () => {
  const volumeForm = sourceBetween(adminForms, 'id="novo-volume"', 'id="novo-capitulo"');
  const input = volumeForm.match(/<input[^>]*name="position"[^>]*>/)?.[0];

  assert.ok(input, "Input de posicao do volume nao encontrado");
  assert.match(input, /\btype="number"/);
  assert.match(input, /\bmin="0"/);
  assert.match(input, /\bstep="any"/);
});
