import assert from "node:assert/strict";
import { test } from "node:test";
import { getNextChapterPosition } from "./admin-chapter-sequence";

test("continua a sequencia depois do ultimo capitulo individual", () => {
  assert.equal(getNextChapterPosition([{ position: 100, positionEnd: null }]), 101);
});

test("continua a sequencia depois de um capitulo decimal", () => {
  assert.equal(getNextChapterPosition([{ position: 8.5, positionEnd: null }]), 9.5);
});

test("continua a sequencia depois do fim de um capitulo agrupado", () => {
  assert.equal(getNextChapterPosition([{ position: 95, positionEnd: 100 }]), 101);
});

test("usa 1 quando o volume ainda nao tem capitulos", () => {
  assert.equal(getNextChapterPosition([]), 1);
});
