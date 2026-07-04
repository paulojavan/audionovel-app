import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getChapterPersistenceBounds, normalizeChapterParts, type ChapterPart } from "./chapter-grouping";

const createRoute = readFileSync(
  join(process.cwd(), "src", "app", "api", "admin", "chapters", "route.ts"),
  "utf8",
);

function deriveCreatePersistence(input: {
  position: number;
  positionEnd: number | null;
  chapterParts: ChapterPart[];
}) {
  const chapterParts = normalizeChapterParts(input.chapterParts);

  return {
    ...getChapterPersistenceBounds(input.position, chapterParts),
    chapterPartsJson: JSON.stringify(chapterParts),
  };
}

test("standalone chapter creation ignores an arbitrary top-level end position", () => {
  assert.deepEqual(
    deriveCreatePersistence({
      position: 8.5,
      positionEnd: 10.5,
      chapterParts: [],
    }),
    {
      position: 8.5,
      positionEnd: null,
      chapterPartsJson: "[]",
    },
  );
});

test("grouped chapter creation derives both bounds from normalized parts", () => {
  const chapterParts = [
    { position: 9, title: "Nove", startSec: 60, endSec: 120 },
    { position: 8, title: "Oito", startSec: 0, endSec: 60 },
  ];

  assert.deepEqual(
    deriveCreatePersistence({
      position: 99,
      positionEnd: null,
      chapterParts,
    }),
    {
      position: 8,
      positionEnd: 9,
      chapterPartsJson: JSON.stringify([
        { position: 8, title: "Oito", startSec: 0, endSec: 60 },
        { position: 9, title: "Nove", startSec: 60, endSec: 120 },
      ]),
    },
  );
});

test("POST persists bounds and JSON derived from the same normalized parts", () => {
  assert.match(
    createRoute,
    /const chapterParts = normalizeChapterParts\(chapter\.chapterParts\);\s*const bounds = getChapterPersistenceBounds\(chapter\.position, chapterParts\);/,
  );
  assert.match(createRoute, /position: bounds\.position,\s*positionEnd: bounds\.positionEnd,/);
  assert.match(createRoute, /chapterPartsJson: JSON\.stringify\(chapterParts\),/);
});
