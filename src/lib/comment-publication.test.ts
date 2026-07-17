import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  PUBLIC_COMMENT_STATUSES,
  getPublicCommentStatusFilter,
} from "./comment-moderation";

const novelPageSource = readFileSync(
  join(process.cwd(), "src", "app", "novels", "[slug]", "page.tsx"),
  "utf8",
);
const chapterPageSource = readFileSync(
  join(process.cwd(), "src", "app", "chapters", "[id]", "page.tsx"),
  "utf8",
);
const selectSource = readFileSync(
  join(process.cwd(), "src", "lib", "page-data-select.ts"),
  "utf8",
);
const formSource = readFileSync(
  join(process.cwd(), "src", "components", "comment-form.tsx"),
  "utf8",
);
const actionsSource = readFileSync(
  join(process.cwd(), "src", "components", "comment-actions.tsx"),
  "utf8",
);
const moderationSource = readFileSync(
  join(process.cwd(), "src", "app", "admin", "moderacao", "page.tsx"),
  "utf8",
);

test("pending comments are public before administrative review", () => {
  assert.deepEqual(PUBLIC_COMMENT_STATUSES, [
    "PENDING",
    "APPROVED",
    "REMOVED",
  ]);
  assert.deepEqual(getPublicCommentStatusFilter(), {
    in: ["PENDING", "APPROVED", "REMOVED"],
  });
});

test("novel, chapter, and reply queries share the public status filter", () => {
  for (const source of [novelPageSource, chapterPageSource, selectSource]) {
    assert.match(source, /getPublicCommentStatusFilter/);
    assert.doesNotMatch(source, /in: \["APPROVED", "REMOVED"\]/);
  }
});

test("comment forms confirm immediate publication", () => {
  assert.match(formSource, /Resposta publicada\./);
  assert.match(formSource, /Comentario publicado\./);
  assert.doesNotMatch(formSource, /enviad[oa] para moderacao/i);
  assert.match(actionsSource, /Comentario editado e publicado\./);
  assert.doesNotMatch(actionsSource, /enviado para moderacao/i);
});

test("moderation panel describes review after publication", () => {
  assert.match(moderationSource, /Comentarios publicados aguardam revisao administrativa\./);
});
