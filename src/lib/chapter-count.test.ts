import assert from "node:assert/strict";
import { test } from "node:test";
import { getStoredChapterCount, getTotalStoredChapterCount } from "./chapter-count";

test("conta capitulo agrupado pelo intervalo de posicoes", () => {
  assert.equal(getStoredChapterCount({ position: 1, positionEnd: 10 }), 10);
});

test("conta capitulo individual como uma unidade", () => {
  assert.equal(getStoredChapterCount({ position: 11, positionEnd: null }), 1);
});

test("conta as partes reais de um grupo com capitulos intermediarios", () => {
  assert.equal(
    getStoredChapterCount({
      position: 10,
      positionEnd: 11,
      chapterPartsJson: JSON.stringify([
        { position: 10 },
        { position: 10.5 },
        { position: 10.6 },
        { position: 10.7 },
        { position: 11 },
      ]),
    }),
    5,
  );
});

test("fallback de grupo decimal nunca produz contagem fracionaria", () => {
  assert.equal(getStoredChapterCount({ position: 10, positionEnd: 10.7, chapterPartsJson: "invalido" }), 1);
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
