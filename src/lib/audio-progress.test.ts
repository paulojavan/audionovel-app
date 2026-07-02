import assert from "node:assert/strict";
import test from "node:test";
import { isPlaybackComplete, mergeCompletion, shouldSaveCheckpoint } from "./audio-progress";

test("considera concluido quando chega a um segundo do final logico", () => {
  assert.equal(isPlaybackComplete(599.2, 600), true);
  assert.equal(isPlaybackComplete(598.5, 600), false);
  assert.equal(isPlaybackComplete(0, 0), false);
});

test("conclusao nunca volta de true para false", () => {
  assert.equal(mergeCompletion(true, false), true);
  assert.equal(mergeCompletion(false, true), true);
  assert.equal(mergeCompletion(false, false), false);
});

test("checkpoint periodico respeita intervalo de quinze segundos", () => {
  assert.equal(shouldSaveCheckpoint(10_000, 24_999), false);
  assert.equal(shouldSaveCheckpoint(10_000, 25_000), true);
});
