import assert from "node:assert/strict";
import test from "node:test";
import { getDurationFromRange } from "./chapter-time";

test("getDurationFromRange calculates chapter duration from start and end", () => {
  assert.equal(getDurationFromRange(15, 90), 75);
});

test("getDurationFromRange does not return negative durations", () => {
  assert.equal(getDurationFromRange(90, 15), 0);
});
