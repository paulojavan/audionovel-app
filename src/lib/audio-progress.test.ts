import assert from "node:assert/strict";
import test from "node:test";
import { getInitialResumePosition, isPlaybackComplete, shouldSaveCheckpoint } from "./audio-progress";

test("considera concluido quando chega a um segundo do final logico", () => {
  assert.equal(isPlaybackComplete(599.2, 600), true);
  assert.equal(isPlaybackComplete(598.5, 600), false);
  assert.equal(isPlaybackComplete(0, 0), false);
});

test("checkpoint periodico respeita intervalo de quinze segundos", () => {
  assert.equal(shouldSaveCheckpoint(10_000, 24_999), false);
  assert.equal(shouldSaveCheckpoint(10_000, 25_000), true);
});

test("capitulo ja concluido reinicia do zero ao ser ouvido novamente", () => {
  assert.equal(getInitialResumePosition(300, 600, true), 0);
  assert.equal(getInitialResumePosition(0, 600, true), 0);
  assert.equal(getInitialResumePosition(600, 600, true), 0);
});

test("capitulo ouvido ate o final pela tolerancia tambem reinicia do zero", () => {
  assert.equal(getInitialResumePosition(599.5, 600, false), 0);
});

test("capitulo em andamento retoma de onde parou", () => {
  assert.equal(getInitialResumePosition(300, 600, false), 300);
  assert.equal(getInitialResumePosition(0, 600, false), 0);
});
