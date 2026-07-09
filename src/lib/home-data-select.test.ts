import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOME_NOVEL_SELECT,
  HOME_RANKING_NOVEL_SELECT,
  LATEST_CHAPTER_SELECT,
} from "./home-data-select";

test("selecoes da home nao solicitam relacionamentos e textos pesados", () => {
  assert.equal("volumes" in HOME_NOVEL_SELECT, false);
  assert.equal("synopsis" in HOME_NOVEL_SELECT, false);
  assert.equal("synopsis" in HOME_RANKING_NOVEL_SELECT, false);
  assert.equal(HOME_NOVEL_SELECT.status, true);
  assert.equal(HOME_RANKING_NOVEL_SELECT.status, true);
  assert.equal(LATEST_CHAPTER_SELECT.volume.select.novel.select.status, true);
  assert.equal("transcriptJson" in LATEST_CHAPTER_SELECT, false);
  assert.equal("chapterPartsJson" in LATEST_CHAPTER_SELECT, false);
  assert.equal("audioUrl" in LATEST_CHAPTER_SELECT, false);
});

test("selecao de lancamentos mantem apenas os campos usados pela interface", () => {
  assert.deepEqual(
    Object.keys(LATEST_CHAPTER_SELECT).sort(),
    [
      "createdAt",
      "id",
      "position",
      "positionEnd",
      "premiumOnly",
      "title",
      "volume",
    ],
  );
});
