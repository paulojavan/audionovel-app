import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const serviceWorkerSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const staticAssetsBlock = serviceWorkerSource.match(/const STATIC_ASSETS = \[[\s\S]*?\];/)?.[0] ?? "";

test("service worker nao pre-cacheia o manifest publico", () => {
  assert.doesNotMatch(staticAssetsBlock, /["']\/manifest\.webmanifest["']/);
  assert.match(serviceWorkerSource, /url\.pathname === "\/manifest\.webmanifest"/);
});

test("service worker nao intercepta chunks internos do Next", () => {
  assert.match(serviceWorkerSource, /url\.pathname\.startsWith\("\/_next\/"\)/);
  assert.doesNotMatch(serviceWorkerSource, /url\.pathname\.startsWith\("\/_next\/static\/"\)\s*return true/);
});

test("service worker limita cache de navegacao ao offline e separa por conta", () => {
  assert.match(serviceWorkerSource, /SET_ACCOUNT_SCOPE/);
  assert.match(serviceWorkerSource, /url\.pathname !== "\/offline"/);
  assert.match(serviceWorkerSource, /getAccountPageCacheName/);
  assert.doesNotMatch(
    serviceWorkerSource,
    /if \(request\.mode === "navigate"\) \{\s*event\.respondWith\(networkFirstWithOfflineFallback\(request\)\)/,
  );
});
