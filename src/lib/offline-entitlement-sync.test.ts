import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { reconcileOfflineEntitlement } from "./offline-entitlement-sync";

test("reconcilia blob e metadado antes de publicar o shell offline", async () => {
  const calls: string[] = [];
  const saved: Array<{ cacheKey: string; expiresAt: string }> = [];
  const result = await reconcileOfflineEntitlement("user-1", {
    ensureDeviceToken: async () => {
      calls.push("device");
    },
    getRecoverableItems: async () => [{
      id: "download-1",
      chapterId: "chapter-1",
      title: "Capitulo",
      novelTitle: "Novel",
      volumeTitle: "Volume",
      chapterPosition: 1,
      cacheKey: "old-key",
      expiresAt: "2026-07-11T00:00:00Z",
    }],
    renewItems: async (chapterIds) => {
      calls.push(`renew:${chapterIds.join(",")}`);
      return [{ chapterId: "chapter-1", cacheKey: "new-key", expiresAt: "2026-08-10T00:00:00Z" }];
    },
    updateItemsBatch: async (_scope, items) => {
      calls.push(`batch:${items.length}`);
      saved.push(...items);
      return items.length;
    },
    preparePage: async () => {
      calls.push("prepare");
    },
  });

  assert.deepEqual(calls, ["device", "renew:chapter-1", "batch:1", "prepare"]);
  assert.deepEqual(
    saved.map(({ cacheKey, expiresAt }) => ({ cacheKey, expiresAt })),
    [{ cacheKey: "new-key", expiresAt: "2026-08-10T00:00:00Z" }],
  );
  assert.deepEqual(result, { renewed: 1 });
});

test("reconciliacao atualiza varios capitulos com uma unica chamada local", async () => {
  const batchSizes: number[] = [];
  const baseItem = {
    id: "download",
    title: "Capitulo",
    novelTitle: "Novel",
    volumeTitle: "Volume",
    chapterPosition: 1,
    cacheKey: "old",
    expiresAt: "2026-07-11T00:00:00Z",
  };

  const result = await reconcileOfflineEntitlement("user-1", {
    ensureDeviceToken: async () => undefined,
    getRecoverableItems: async () => [
      { ...baseItem, chapterId: "chapter-1" },
      { ...baseItem, chapterId: "chapter-2" },
    ],
    renewItems: async () => [
      { chapterId: "chapter-1", cacheKey: "new-1", expiresAt: "2026-08-10T00:00:00Z" },
      { chapterId: "chapter-2", cacheKey: "new-2", expiresAt: "2026-08-10T00:00:00Z" },
    ],
    updateItemsBatch: async (_scope, items) => {
      batchSizes.push(items.length);
      return items.length;
    },
    preparePage: async () => undefined,
  });

  assert.deepEqual(batchSizes, [2]);
  assert.deepEqual(result, { renewed: 2 });
});

test("reconciliacao renova um lote justo de cem capitulos por execucao", async () => {
  const baseItem = {
    id: "download",
    title: "Capitulo",
    novelTitle: "Novel",
    volumeTitle: "Volume",
    chapterPosition: 1,
    cacheKey: "old",
    expiresAt: "2026-07-11T00:00:00Z",
  };
  const items = Array.from({ length: 101 }, (_, index) => ({
    ...baseItem,
    id: `download-${index}`,
    chapterId: `chapter-${index.toString().padStart(3, "0")}`,
  }));
  const renewalBatchSizes: number[] = [];
  const renewedChapterBatches: string[][] = [];
  const localBatchSizes: number[] = [];
  const dependencies = {
    ensureDeviceToken: async () => undefined,
    getRecoverableItems: async () => items,
    renewItems: async (chapterIds) => {
      renewalBatchSizes.push(chapterIds.length);
      renewedChapterBatches.push(chapterIds);
      return chapterIds.map((chapterId) => ({
        chapterId,
        cacheKey: `new-${chapterId}`,
        expiresAt: "2026-08-10T00:00:00Z",
      }));
    },
    updateItemsBatch: async (_scope, renewedItems) => {
      localBatchSizes.push(renewedItems.length);
      return renewedItems.length;
    },
    preparePage: async () => undefined,
  };

  const firstResult = await reconcileOfflineEntitlement(
    "user-1",
    dependencies,
  );
  const secondResult = await reconcileOfflineEntitlement(
    "user-1",
    dependencies,
    firstResult.nextCursor,
  );

  assert.deepEqual(renewalBatchSizes, [100, 100]);
  assert.deepEqual(localBatchSizes, [100, 100]);
  assert.equal(firstResult.nextCursor, "chapter-099");
  assert.equal(renewedChapterBatches[1][0], "chapter-100");
  assert.equal(secondResult.renewed, 100);
});

test("layout monta sincronizacao somente para premium ativo", () => {
  const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
  assert.match(layout, /OfflineEntitlementSync/);
  assert.match(layout, /hasPremiumAccess\(activeSession\.user\)/);
  assert.match(layout, /accountScope=\{activeSession\.user\.id\}/);
});

test("coordenador aguarda catalogo no offline e limita rede e repeticoes", () => {
  const component = readFileSync(
    join(process.cwd(), "src", "components", "offline-entitlement-sync.tsx"),
    "utf8",
  );

  assert.match(component, /usePathname/);
  assert.match(component, /waitForOfflineCatalogReady/);
  assert.match(component, /updateOfflineItemsBatch/);
  assert.match(component, /AbortController/);
  assert.match(component, /getOfflineSyncNextAttemptAt\("success"/);
  assert.match(component, /getOfflineSyncNextAttemptAt\("failure"/);
  assert.match(component, /offline-renew-cursor/);
  assert.doesNotMatch(component, /extendOfflineAudioExpiry/);
  assert.doesNotMatch(component, /saveOfflineItem/);
});
