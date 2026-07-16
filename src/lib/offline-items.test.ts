import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeAvailableOfflineItems,
  mergeOfflineItems,
  removeExpiredOfflineItems,
} from "./offline-items";

const baseItem = {
  id: "download-1",
  chapterId: "chapter-1",
  title: "Capitulo 1",
  novelTitle: "Novel",
  volumeTitle: "Volume 1",
  chapterPosition: 1,
  cacheKey: "cache-key",
  expiresAt: "2026-06-20T00:00:00.000Z",
};

test("mergeOfflineItems keeps one entry per chapter preferring local metadata", () => {
  const merged = mergeOfflineItems(
    [{ ...baseItem, id: "server", title: "Servidor" }],
    [{ ...baseItem, id: "local", title: "Local" }],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "local");
  assert.equal(merged[0].title, "Local");
});

test("mergeOfflineItems preserves server chapter parts for older local metadata", () => {
  const chapterParts = [{ position: 1, title: "Parte 1", startSec: 10, endSec: 20 }];
  const merged = mergeOfflineItems(
    [{ ...baseItem, id: "server", title: "Servidor", chapterParts }],
    [{ ...baseItem, id: "local", title: "Local" }],
  );

  assert.equal(merged[0].id, "local");
  assert.equal(merged[0].title, "Local");
  assert.deepEqual(merged[0].chapterParts, chapterParts);
});

test("mergeAvailableOfflineItems nunca adiciona capitulo que nao existe localmente", () => {
  const merged = mergeAvailableOfflineItems(
    [
      { ...baseItem, chapterId: "local", id: "server-local", title: "Servidor" },
      { ...baseItem, chapterId: "server-only", id: "server-only" },
    ],
    [{ ...baseItem, chapterId: "local", id: "local", title: "Local" }],
  );

  assert.deepEqual(merged.map((item) => item.chapterId), ["local"]);
  assert.equal(merged[0].title, "Local");
});

test("removeExpiredOfflineItems removes expired metadata", () => {
  const items = removeExpiredOfflineItems(
    [
      { ...baseItem, chapterId: "expired", expiresAt: "2026-06-01T00:00:00.000Z" },
      { ...baseItem, chapterId: "valid", expiresAt: "2026-06-20T00:00:00.000Z" },
    ],
    new Date("2026-06-14T00:00:00.000Z").getTime(),
  );

  assert.deepEqual(items.map((item) => item.chapterId), ["valid"]);
});
