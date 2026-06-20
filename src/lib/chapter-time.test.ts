import assert from "node:assert/strict";
import test from "node:test";
import { getChapterPositionLabel, getDurationFromRange, getGroupedChapterDuration, getGroupedChapterPositionEnd } from "./chapter-time";

test("getDurationFromRange calculates chapter duration from start and end", () => {
  assert.equal(getDurationFromRange(15, 90), 75);
});

test("getDurationFromRange does not return negative durations", () => {
  assert.equal(getDurationFromRange(90, 15), 0);
});

test("getChapterPositionLabel formats grouped chapter ranges", () => {
  assert.equal(getChapterPositionLabel(1, 10), "1-10");
  assert.equal(getChapterPositionLabel(4, null), "4");
  assert.equal(getChapterPositionLabel(5, 5), "5");
});

test("getGroupedChapterPositionEnd returns the last chapter number for grouped chapters", () => {
  assert.equal(getGroupedChapterPositionEnd([1, 2, 10]), 10);
  assert.equal(getGroupedChapterPositionEnd([3]), null);
});

test("getGroupedChapterDuration covers the full grouped time range", () => {
  assert.equal(
    getGroupedChapterDuration([
      { startSec: 0, durationSec: 60 },
      { startSec: 60, durationSec: 120 },
      { startSec: 180, durationSec: 30 },
    ]),
    210,
  );
});
