import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  getChapterAudioPath,
  shouldIncrementAudioRevision,
} from "./audio-revision";

const schemaSource = readFileSync(
  join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
);
const validationSource = readFileSync(
  join(process.cwd(), "src", "lib", "admin-chapter-validation.ts"),
  "utf8",
);
const editRouteSource = readFileSync(
  join(
    process.cwd(),
    "src",
    "app",
    "api",
    "admin",
    "chapters",
    "[id]",
    "route.ts",
  ),
  "utf8",
);
const formSource = readFileSync(
  join(process.cwd(), "src", "components", "admin-content-forms.tsx"),
  "utf8",
);

test("increments the revision when the media URL changes", () => {
  assert.equal(
    shouldIncrementAudioRevision(
      { contentType: "AUDIO", audioUrl: "https://cdn.example/a.mp3" },
      { contentType: "AUDIO", audioUrl: "https://cdn.example/b.mp3" },
      false,
    ),
    true,
  );
});

test("increments the revision when the media type changes", () => {
  assert.equal(
    shouldIncrementAudioRevision(
      { contentType: "AUDIO", audioUrl: "https://cdn.example/a.mp3" },
      { contentType: "YOUTUBE", audioUrl: null },
      false,
    ),
    true,
  );
});

test("supports replacement at the same URL without invalidating metadata-only edits", () => {
  const media = {
    contentType: "AUDIO",
    audioUrl: "https://cdn.example/a.mp3",
  };

  assert.equal(shouldIncrementAudioRevision(media, media, true), true);
  assert.equal(shouldIncrementAudioRevision(media, media, false), false);
});

test("normalizes empty audio URLs before comparing media identity", () => {
  assert.equal(
    shouldIncrementAudioRevision(
      { contentType: "YOUTUBE", audioUrl: null },
      { contentType: "YOUTUBE", audioUrl: "" },
      false,
    ),
    false,
  );
});

test("builds versioned online and authorized offline audio paths", () => {
  assert.equal(
    getChapterAudioPath("chapter 1", 3),
    "/api/chapters/chapter%201/audio?revision=3",
  );
  assert.equal(
    getChapterAudioPath("chapter 1", 3, "key/value"),
    "/api/chapters/chapter%201/audio?revision=3&offline=key%2Fvalue",
  );
});

test("persists chapter audio revisions with a safe database default", () => {
  assert.match(schemaSource, /audioRevision\s+Int\s+@default\(1\)/);

  const sqlPath = join(
    process.cwd(),
    "prisma",
    "aiven-2026-07-17-audio-revisions.sql",
  );
  assert.equal(existsSync(sqlPath), true);
  if (!existsSync(sqlPath)) return;
  assert.match(
    readFileSync(sqlPath, "utf8"),
    /"audioRevision" INTEGER NOT NULL DEFAULT 1/,
  );
});

test("validates and persists explicit revision refreshes", () => {
  assert.match(validationSource, /refreshAudioRevision:\s*z\.boolean\(\)/);
  assert.match(editRouteSource, /shouldIncrementAudioRevision/);
  assert.match(editRouteSource, /audioRevision:\s*\{\s*increment:\s*1\s*\}/);
});

test("admin form can mark replacement at the same URL", () => {
  assert.match(formSource, /name="refreshAudioRevision"/);
  assert.match(
    formSource,
    /refreshAudioRevision:\s*data\.get\("refreshAudioRevision"\)\s*===\s*"on"/,
  );
  assert.match(formSource, /substituido na mesma URL/);
});
