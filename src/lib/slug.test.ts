import assert from "node:assert/strict";
import test from "node:test";
import { slugify } from "./slug";

test("normalizes accents and punctuation", () => {
  assert.equal(slugify("Áudio Novel BR!"), "audio-novel-br");
});

test("uses fallback when value has no slug characters", () => {
  assert.equal(slugify("!!!", { fallback: "item" }), "item");
});

test("respects max length after cleanup", () => {
  assert.equal(slugify("Capítulo Muito Grande", { maxLength: 8 }), "capitulo");
});
