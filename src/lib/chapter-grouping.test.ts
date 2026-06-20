import assert from "node:assert/strict";
import test from "node:test";
import { getChapterPartsForDisplay, getGroupedChapterSummary, parseChapterParts } from "./chapter-grouping";

test("getGroupedChapterSummary combines chapter titles and range", () => {
  const grouped = getGroupedChapterSummary([
    { title: "Abertura", position: 1, startSec: 0, durationSec: 60 },
    { title: "Conflito", position: 2, startSec: 60, durationSec: 120 },
    { title: "Virada", position: 3, startSec: 180, durationSec: 30 },
  ]);

  assert.deepEqual(grouped, {
    title: "Abertura, Conflito, Virada",
    position: 1,
    positionEnd: 3,
    startSec: 0,
    durationSec: 210,
    youtubeUrl: undefined,
    chapterPartsJson: JSON.stringify([
      { position: 1, title: "Abertura", startSec: 0, endSec: 60 },
      { position: 2, title: "Conflito", startSec: 60, endSec: 180 },
      { position: 3, title: "Virada", startSec: 180, endSec: 210 },
    ]),
  });
});

test("getGroupedChapterSummary sorts chapters by position before combining", () => {
  const grouped = getGroupedChapterSummary([
    { title: "Segundo", position: 2, startSec: 30, durationSec: 30 },
    { title: "Primeiro", position: 1, startSec: 0, durationSec: 30 },
  ]);

  assert.equal(grouped.title, "Primeiro, Segundo");
  assert.equal(grouped.position, 1);
  assert.equal(grouped.positionEnd, 2);
});

test("parseChapterParts returns normalized sorted parts", () => {
  const parts = parseChapterParts(
    JSON.stringify([
      { position: 2, title: "Segundo", startSec: 60, endSec: 120 },
      { position: 1, title: "Primeiro", startSec: 0, endSec: 60 },
    ]),
  );

  assert.deepEqual(parts, [
    { position: 1, title: "Primeiro", startSec: 0, endSec: 60 },
    { position: 2, title: "Segundo", startSec: 60, endSec: 120 },
  ]);
});

test("getChapterPartsForDisplay derives fallback parts for old grouped chapters", () => {
  const parts = getChapterPartsForDisplay({
    title: "Um, Dois",
    position: 1,
    positionEnd: 2,
    startSec: 30,
    durationSec: 120,
    chapterPartsJson: "[]",
  });

  assert.deepEqual(parts, [
    { position: 1, title: "Um", startSec: 30, endSec: 90 },
    { position: 2, title: "Dois", startSec: 90, endSec: 150 },
  ]);
});
