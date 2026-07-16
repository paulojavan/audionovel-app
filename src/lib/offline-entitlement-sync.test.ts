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
    extendAudioExpiry: async () => {
      calls.push("extend");
      return true;
    },
    saveItem: async (_scope, item) => {
      calls.push("save");
      saved.push(item);
    },
    preparePage: async () => {
      calls.push("prepare");
    },
  });

  assert.deepEqual(calls, ["device", "renew:chapter-1", "extend", "save", "prepare"]);
  assert.deepEqual(
    saved.map(({ cacheKey, expiresAt }) => ({ cacheKey, expiresAt })),
    [{ cacheKey: "new-key", expiresAt: "2026-08-10T00:00:00Z" }],
  );
  assert.deepEqual(result, { renewed: 1 });
});

test("layout monta sincronizacao somente para premium ativo", () => {
  const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
  assert.match(layout, /OfflineEntitlementSync/);
  assert.match(layout, /hasPremiumAccess\(activeSession\.user\)/);
  assert.match(layout, /accountScope=\{activeSession\.user\.id\}/);
});
