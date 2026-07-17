import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  CHAPTER_PAGE_SELECT,
  OFFLINE_DOWNLOAD_SELECT,
  PUBLIC_NOVEL_SELECT,
} from "./page-data-select";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

const chapterPage = source("src", "app", "chapters", "[id]", "page.tsx");
const novelVolumeList = source("src", "components", "novel-volume-list.tsx");
const prepareRoute = source("src", "app", "api", "offline", "prepare", "route.ts");
const renewRoute = source("src", "app", "api", "offline", "renew", "route.ts");
const offlinePage = source("src", "app", "offline", "page.tsx");
const offlineItems = source("src", "lib", "offline-items.ts");

test("page and offline selects expose the current audio revision", () => {
  assert.equal(CHAPTER_PAGE_SELECT.audioRevision, true);
  assert.equal(
    PUBLIC_NOVEL_SELECT.volumes.select.chapters.select.audioRevision,
    true,
  );
  assert.equal(OFFLINE_DOWNLOAD_SELECT.chapter.select.audioRevision, true);
});

test("chapter playback uses a revisioned logical source", () => {
  assert.match(chapterPage, /getChapterAudioPath/);
  assert.match(chapterPage, /audioRevision=\{access\.chapter\.audioRevision\}/);
  assert.match(
    chapterPage,
    /src=\{getChapterAudioPath\(id, access\.chapter\.audioRevision\)\}/,
  );
});

test("offline preparation and renewal return authorized revisioned sources", () => {
  for (const route of [prepareRoute, renewRoute]) {
    assert.match(route, /getChapterAudioPath/);
    assert.match(route, /audioRevision/);
  }
  assert.match(prepareRoute, /audioUrl:\s*getChapterAudioPath/);
  assert.match(renewRoute, /audioUrl:\s*getChapterAudioPath/);
});

test("offline metadata carries the revision from catalog to device", () => {
  assert.match(offlineItems, /audioRevision\?:\s*number/);
  assert.match(novelVolumeList, /audioRevision:\s*number/);
  assert.match(novelVolumeList, /audioRevision:\s*chapter\.audioRevision/);
  assert.match(offlinePage, /audioRevision:\s*download\.chapter\.audioRevision/);
});
