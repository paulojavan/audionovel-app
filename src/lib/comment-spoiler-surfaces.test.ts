import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const thread = readFileSync("src/components/comment-thread.tsx", "utf8");
const form = readFileSync("src/components/comment-form.tsx", "utf8");
const actions = readFileSync("src/components/comment-actions.tsx", "utf8");
const hintPath = "src/components/comment-spoiler-hint.tsx";
const hint = existsSync(hintPath) ? readFileSync(hintPath, "utf8") : "";
const moderation = readFileSync("src/app/admin/moderacao/page.tsx", "utf8");

test("public non-removed comments delegate body rendering to CommentBodyText", () => {
  assert.match(thread, /import \{ CommentBodyText \}/);
  assert.match(thread, /removed[\s\S]*Comentario removido pelo administrador\.[\s\S]*CommentBodyText/);
  assert.match(thread, /<CommentBodyText key=\{comment\.body\} body=\{comment\.body\} \/>/);
});

test("new reply and edit forms explain the spoiler syntax", () => {
  assert.ok(existsSync(hintPath), "shared spoiler hint is required");
  assert.match(hint, /Use[\s\S]*\[spoiler\]texto\[\/spoiler\][\s\S]*para ocultar spoilers\./);
  assert.match(form, /<textarea[\s\S]*?\/>\s*<CommentSpoilerHint \/>/);
  assert.match(actions, /<textarea[\s\S]*?\/>\s*<CommentSpoilerHint \/>/);
});

test("administrative moderation keeps the raw body", () => {
  assert.match(moderation, /\{comment\.body\}/);
  assert.doesNotMatch(moderation, /CommentBodyText/);
});
