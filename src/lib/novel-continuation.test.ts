import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getNovelContinuationErrorMessage,
  validateNovelContinuation,
} from "./novel-continuation";

const novels = [
  { id: "a", continuationId: "b" },
  { id: "b", continuationId: "c" },
  { id: "c", continuationId: null },
];

test("aceita remocao e cadeia valida", () => {
  assert.equal(validateNovelContinuation("a", null, novels), null);
  assert.equal(validateNovelContinuation("c", "a", novels), "CYCLE");
  assert.equal(validateNovelContinuation("a", "c", novels), null);
});

test("recusa id inexistente e autorreferencia", () => {
  assert.equal(validateNovelContinuation("a", "missing", novels), "NOT_FOUND");
  assert.equal(validateNovelContinuation("a", "a", novels), "SELF_REFERENCE");
  assert.equal(
    getNovelContinuationErrorMessage("SELF_REFERENCE"),
    "Uma novel não pode ser continuação dela mesma.",
  );
});
