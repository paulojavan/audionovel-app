import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const adminForms = readFileSync("src/components/admin-content-forms.tsx", "utf8");

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

test("Chapter persiste posicoes zero e decimais sem alterar Volume.position", () => {
  const volumeModel = sourceBetween(schema, "model Volume {", "model Chapter {");
  const chapterModel = sourceBetween(schema, "model Chapter {", "model ListeningProgress {");

  assert.match(volumeModel, /\bposition\s+Int\b/);
  assert.match(chapterModel, /\bposition\s+Float\b/);
  assert.match(chapterModel, /\bpositionEnd\s+Float\?/);
  assert.match(chapterModel, /@@unique\(\[volumeId, position\]\)/);
});

test("inputs de posicao de capitulo aceitam zero e decimais", () => {
  const editForm = sourceBetween(adminForms, "export function AdminChapterEditForm(", "export function AdminNovelForm(");
  const batchFields = sourceBetween(adminForms, "function ChapterBatchTable(", "function ChapterBlockFields(");
  const blockFields = sourceBetween(adminForms, "function ChapterBlockFields(", "function PublishFields(");

  assertFlexibleChapterPositionInput(editForm, '"position"');
  assertFlexibleChapterPositionInput(batchFields, "{`chapter\\.\\$\\{index\\}\\.position`}");
  assertFlexibleChapterPositionInput(blockFields, "{`chapter\\.\\$\\{index\\}\\.position`}");
});

test("input de posicao de volume continua inteiro e com minimo um", () => {
  const volumeForm = sourceBetween(adminForms, 'id="novo-volume"', 'id="novo-capitulo"');
  const input = volumeForm.match(/<input[^>]*name="position"[^>]*>/)?.[0];

  assert.ok(input, "Input de posicao do volume nao encontrado");
  assert.match(input, /\btype="number"/);
  assert.match(input, /\bmin="1"/);
  assert.doesNotMatch(input, /\bstep=/);
});
