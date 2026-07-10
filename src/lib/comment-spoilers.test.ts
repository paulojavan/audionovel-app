import assert from "node:assert/strict";
import test from "node:test";
import { parseCommentSpoilers } from "./comment-spoilers";

test("preserves a comment without spoiler tags", () => {
  assert.deepEqual(parseCommentSpoilers("Texto comum."), [
    { type: "text", content: "Texto comum." },
  ]);
});

test("splits public text from one spoiler", () => {
  assert.deepEqual(parseCommentSpoilers("Antes [spoiler]segredo[/spoiler] depois"), [
    { type: "text", content: "Antes " },
    { type: "spoiler", content: "segredo" },
    { type: "text", content: " depois" },
  ]);
});

test("parses multiple independent spoilers including line breaks", () => {
  assert.deepEqual(
    parseCommentSpoilers("A [spoiler]um\ndois[/spoiler] B [spoiler]três[/spoiler]"),
    [
      { type: "text", content: "A " },
      { type: "spoiler", content: "um\ndois" },
      { type: "text", content: " B " },
      { type: "spoiler", content: "três" },
    ],
  );
});

test("keeps incomplete empty and incorrectly capitalized tags literal", () => {
  for (const body of [
    "[spoiler]sem fechamento",
    "[spoiler][/spoiler]",
    "[SPOILER]segredo[/SPOILER]",
  ]) {
    assert.deepEqual(parseCommentSpoilers(body), [{ type: "text", content: body }]);
  }
});

test("keeps an entire nested sequence literal", () => {
  const body = "[spoiler]fora [spoiler]dentro[/spoiler] fim[/spoiler]";
  assert.deepEqual(parseCommentSpoilers(body), [{ type: "text", content: body }]);
});

test("returns no segments for an empty body", () => {
  assert.deepEqual(parseCommentSpoilers(""), []);
});
