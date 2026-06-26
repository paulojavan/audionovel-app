import assert from "node:assert/strict";
import { test } from "node:test";
import { getStoredChapterCount, getTotalStoredChapterCount } from "./chapter-count";

test("conta capitulo agrupado pelo intervalo de posicoes", () => {
  assert.equal(getStoredChapterCount({ position: 1, positionEnd: 10 }), 10);
});

test("conta capitulo individual como uma unidade", () => {
  assert.equal(getStoredChapterCount({ position: 11, positionEnd: null }), 1);
});

test("soma capitulos individuais e agrupados", () => {
  assert.equal(
    getTotalStoredChapterCount([
      { position: 1, positionEnd: 10 },
      { position: 11, positionEnd: null },
      { position: 12, positionEnd: 15 },
    ]),
    15,
  );
});
