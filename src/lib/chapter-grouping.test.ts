import assert from "node:assert/strict";
import test from "node:test";
import { getGroupedChapterSummary } from "./chapter-grouping";

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
