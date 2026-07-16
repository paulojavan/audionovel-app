import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountStorageKey } from "./account-scope";
import { selectAvailableOfflineItems } from "./offline-catalog";
import type { OfflineItem } from "./offline-items";

const NOW = new Date("2026-07-16T12:00:00.000Z").getTime();

function createItem(chapterId: string, expiresAt = "2026-08-16T12:00:00.000Z"): OfflineItem {
  return {
    id: `download-${chapterId}`,
    chapterId,
    title: `Capitulo ${chapterId}`,
    novelTitle: "Novel",
    volumeTitle: "Volume",
    chapterPosition: 1,
    cacheKey: `key-${chapterId}`,
    expiresAt,
  };
}

function offlineAudioId(accountScope: string, chapterId: string) {
  return buildAccountStorageKey(accountScope, `offline:chapter:${chapterId}`);
}

test("seleciona somente metadados vigentes que possuem chave de audio", () => {
  const active = createItem("active");
  const expired = createItem("expired", "2026-07-15T12:00:00.000Z");
  const missing = createItem("missing");

  assert.deepEqual(
    selectAvailableOfflineItems(
      [active, expired, missing],
      [offlineAudioId("user-1", "active"), offlineAudioId("user-1", "expired")],
      "user-1",
      NOW,
    ),
    [active],
  );
});

test("ignora chaves de audio pertencentes a outra conta", () => {
  const item = createItem("chapter-1");

  assert.deepEqual(
    selectAvailableOfflineItems(
      [item],
      [offlineAudioId("user-2", item.chapterId)],
      "user-1",
      NOW,
    ),
    [],
  );
});

test("mantem o mesmo resultado para cem capitulos sem ler valores de audio", () => {
  const items = Array.from({ length: 100 }, (_, index) => createItem(`chapter-${index}`));
  const keys = items.map((item) => offlineAudioId("user-1", item.chapterId));

  assert.equal(
    selectAvailableOfflineItems(items, keys, "user-1", NOW).length,
    100,
  );
});
