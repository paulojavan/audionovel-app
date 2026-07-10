import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { CommentBodyText } from "../components/comment-body-text";

const source = readFileSync("src/components/comment-body-text.tsx", "utf8");

test("hides spoiler content in the initial accessible control", () => {
  const html = renderToStaticMarkup(
    createElement(CommentBodyText, {
      body: "Antes [spoiler]<strong>segredo</strong>[/spoiler] depois",
    }),
  );

  assert.match(html, /Antes /);
  assert.match(html, / depois/);
  assert.match(html, /Spoiler — clique para revelar/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /segredo/);
  assert.doesNotMatch(html, /<strong>/);
});

test("renders independent controls for multiple spoilers", () => {
  const html = renderToStaticMarkup(
    createElement(CommentBodyText, {
      body: "[spoiler]um[/spoiler] [spoiler]dois[/spoiler]",
    }),
  );
  assert.equal(html.match(/Spoiler — clique para revelar/g)?.length, 2);
});

test("reveal state only moves to true", () => {
  assert.match(source, /onClick=\{\(\) => setRevealed\(true\)\}/);
  assert.doesNotMatch(source, /setRevealed\(\(.*!.*\)\)/);
  assert.match(source, /aria-expanded=\{revealed\}/);
});
