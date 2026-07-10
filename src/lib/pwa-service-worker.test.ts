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

test("service worker usa cache-first para chunks versionados do Next", () => {
  assert.match(serviceWorkerSource, /CACHE_VERSION = "v9"/);
  assert.match(serviceWorkerSource, /RELEASE_REVISION = "player-overlays-2026-07-10"/);
  assert.match(
    serviceWorkerSource,
    /postMessage\(\{ version: CACHE_VERSION, revision: RELEASE_REVISION \}\)/,
  );
  assert.match(
    serviceWorkerSource,
    /url\.pathname\.startsWith\("\/_next\/static\/"\)[\s\S]*?event\.respondWith\(cacheFirst\(request\)\)/,
  );
  assert.ok(
    serviceWorkerSource.indexOf('url.pathname.startsWith("/_next/static/")') <
      serviceWorkerSource.indexOf('url.pathname.startsWith("/_next/")'),
  );
});

test("service worker limita cache de navegacao as rotas aprovadas e separa por conta", () => {
  assert.match(serviceWorkerSource, /SET_ACCOUNT_SCOPE/);
  assert.match(serviceWorkerSource, /isCacheableNavigationPath\(url\.pathname\)/);
  assert.match(serviceWorkerSource, /getAccountPageCacheName/);
  assert.match(
    serviceWorkerSource,
    /networkFirstWithPageCache\(request, event\)/,
  );
  assert.doesNotMatch(serviceWorkerSource, /getAccountOfflineRedirect/);
});

test("service worker prepara html e chunks offline antes da primeira visita", () => {
  assert.match(serviceWorkerSource, /event\.data\?\.type === "PREPARE_OFFLINE_PAGE"/);
  assert.match(serviceWorkerSource, /prepareOfflinePage\(event\.data\.scope\)/);
  assert.match(serviceWorkerSource, /scope !== \(await getAccountScope\(\)\)/);
  assert.match(serviceWorkerSource, /fetch\("\/offline",[\s\S]*?credentials: "include"/);
  assert.match(serviceWorkerSource, /extractNextStaticAssetUrls\(html\)/);
  assert.match(
    serviceWorkerSource,
    /await Promise\.all\([\s\S]*?await caches\.open\(getAccountPageCacheName\(scope\)\)/,
  );
  assert.match(serviceWorkerSource, /pageCache\.put\("\/offline", response\)/);
});
