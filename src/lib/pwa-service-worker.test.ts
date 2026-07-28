import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PWA_ICON_REVISION } from "./pwa-assets";

const serviceWorkerSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const staticAssetsBlock = serviceWorkerSource.match(/const STATIC_ASSETS = \[[\s\S]*?\];/)?.[0] ?? "";

test("service worker nao pre-cacheia o manifest publico", () => {
  assert.doesNotMatch(staticAssetsBlock, /["']\/manifest\.webmanifest["']/);
  assert.match(serviceWorkerSource, /url\.pathname === "\/manifest\.webmanifest"/);
});

test("service worker usa cache-first para chunks versionados do Next", () => {
  assert.match(serviceWorkerSource, /CACHE_VERSION = "v13"/);
  assert.match(serviceWorkerSource, /RELEASE_REVISION = "pwa-icon-refresh-2026-07-28"/);
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

test("service worker pre-cacheia a revisao atual dos icones", () => {
  assert.ok(staticAssetsBlock.includes(`/icon-192x192.png?v=${PWA_ICON_REVISION}`));
  assert.ok(staticAssetsBlock.includes(`/icon-512x512.png?v=${PWA_ICON_REVISION}`));
  assert.ok(staticAssetsBlock.includes(`/maskable-512x512.png?v=${PWA_ICON_REVISION}`));
});

test("service worker limita cache de navegacao as rotas aprovadas e separa por conta", () => {
  assert.match(serviceWorkerSource, /SET_ACCOUNT_SCOPE/);
  assert.match(serviceWorkerSource, /setAccountScope\(event\.data\.scope\)[\s\S]*?postMessage\(\{ ok: true/);
  assert.match(serviceWorkerSource, /isCacheableNavigationPath\(url\.pathname\)/);
  assert.match(serviceWorkerSource, /getAccountPageCacheName/);
  assert.match(
    serviceWorkerSource,
    /networkFirstWithPageCache\(request, event\)/,
  );
  assert.doesNotMatch(serviceWorkerSource, /getAccountOfflineRedirect/);
});

test("paginas de capitulo so recorrem ao cache quando a rede realmente falha", () => {
  assert.match(
    serviceWorkerSource,
    /url\.pathname\.startsWith\("\/chapters\/"\)\s*\?\s*networkFirstChapterPage\(request, event\)/,
  );
  assert.match(serviceWorkerSource, /async function networkFirstChapterPage/);
  const chapterBlock = serviceWorkerSource.match(
    /async function networkFirstChapterPage[\s\S]*?\n\}/,
  )?.[0] ?? "";
  assert.doesNotMatch(chapterBlock, /setTimeout/);
});

test("navegacoes visitadas e shell offline nao usam timeout artificial", () => {
  for (const functionName of ["networkFirstWithPageCache", "accountScopedOfflinePage"]) {
    const block = serviceWorkerSource.match(
      new RegExp(`async function ${functionName}[\\s\\S]*?\\n\\}`),
    )?.[0] ?? "";
    assert.ok(block, `funcao ${functionName} encontrada`);
    assert.doesNotMatch(block, /setTimeout/);
    assert.doesNotMatch(block, /Promise\.race/);
  }
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
