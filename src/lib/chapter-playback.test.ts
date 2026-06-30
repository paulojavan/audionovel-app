import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveChapterPartIndex,
  getAdjacentChapterPart,
  getChapterPartSeekDetail,
} from "./chapter-playback";

const parts = [
  { position: 1, title: "Um", startSec: 30, endSec: 90 },
  { position: 2, title: "Dois", startSec: 90, endSec: 150 },
  { position: 3, title: "Três", startSec: 150, endSec: 210 },
];

test("identifica a parte agrupada pelo tempo absoluto", () => {
  assert.equal(getActiveChapterPartIndex(parts, 30), 0);
  assert.equal(getActiveChapterPartIndex(parts, 120), 1);
  assert.equal(getActiveChapterPartIndex(parts, 210), 2);
});

test("encontra partes anterior e seguinte", () => {
  assert.equal(getAdjacentChapterPart(parts, 120, "previous")?.position, 1);
  assert.equal(getAdjacentChapterPart(parts, 120, "next")?.position, 3);
});

test("respeita os limites do agrupamento", () => {
  assert.equal(getAdjacentChapterPart(parts, 30, "previous"), null);
  assert.equal(getAdjacentChapterPart(parts, 210, "next"), null);
});

test("clique em uma parte solicita posicionamento com autoplay", () => {
  assert.deepEqual(getChapterPartSeekDetail(parts[1]), {
    startSec: 90,
    autoplay: true,
  });
});

test("lista vazia nao oferece parte ativa nem navegacao", () => {
  assert.equal(getActiveChapterPartIndex([], 30), -1);
  assert.equal(getAdjacentChapterPart([], 30, "next"), null);
});
