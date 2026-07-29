import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PWA_ICON_REVISION } from "./pwa-assets";

const serviceWorkerSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const proxySource = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");
const staticAssetsBlock = serviceWorkerSource.match(/const STATIC_ASSETS = \[[\s\S]*?\];/)?.[0] ?? "";

test("service worker nao pre-cacheia o manifest publico", () => {
  assert.doesNotMatch(staticAssetsBlock, /["']\/manifest\.webmanifest["']/);
  assert.match(serviceWorkerSource, /url\.pathname === "\/manifest\.webmanifest"/);
});

test("service worker usa cache-first para chunks versionados do Next", () => {
  assert.match(serviceWorkerSource, /CACHE_VERSION = "v15"/);
  assert.match(serviceWorkerSource, /RELEASE_REVISION = "pwa-startup-recovery-2026-07-29"/);
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

test("service worker ativa a correcao sem depender da interface antiga", () => {
  const installBlock = serviceWorkerSource.match(
    /self\.addEventListener\("install"[\s\S]*?\n\}\);/,
  )?.[0] ?? "";

  assert.match(installBlock, /Promise\.allSettled/);
  assert.match(installBlock, /finally[\s\S]*?self\.skipWaiting\(\)/);
  assert.match(staticAssetsBlock, /loading-fallback\.html/);
  assert.match(proxySource, /["']\/loading-fallback\.html["']/);
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

test("paginas de capitulo usam recuperacao na lentidao e cache apenas na queda real", () => {
  assert.match(
    serviceWorkerSource,
    /url\.pathname\.startsWith\("\/chapters\/"\)\s*\?\s*networkFirstChapterPage\(request, event\)/,
  );
  assert.match(serviceWorkerSource, /async function networkFirstChapterPage/);
  const chapterBlock = serviceWorkerSource.match(
    /async function networkFirstChapterPage[\s\S]*?\n\}/,
  )?.[0] ?? "";
  assert.match(chapterBlock, /waitForNetworkResult/);
  assert.match(chapterBlock, /result\.kind === "failure"[\s\S]*?cache\.match/);
  assert.match(chapterBlock, /getNavigationRecoveryFallback/);
});

test("navegacoes presas terminam em cache compativel ou tela de recuperacao", () => {
  for (const functionName of ["networkFirstWithPageCache", "accountScopedOfflinePage"]) {
    const block = serviceWorkerSource.match(
      new RegExp(`async function ${functionName}[\\s\\S]*?\\n\\}`),
    )?.[0] ?? "";
    assert.ok(block, `funcao ${functionName} encontrada`);
    assert.match(block, /waitForNetworkResult/);
    assert.match(block, /getNavigationRecoveryFallback/);
  }
  assert.match(serviceWorkerSource, /NAVIGATION_RESPONSE_TIMEOUT_MS = 12_000/);
  assert.match(serviceWorkerSource, /async function getCompatibleCachedNavigation/);
  assert.match(serviceWorkerSource, /assets\.every\(Boolean\)/);
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
