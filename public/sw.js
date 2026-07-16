// Audio Novel BR - Service Worker v11
// Estratégia: cache estático compartilhado e páginas visitadas isoladas por conta.

const CACHE_PREFIX = "audio-novel-br-pwa";
const CACHE_VERSION = "v11";
const RELEASE_REVISION = "offline-loading-performance-2026-07-16";
const PREVIOUS_CACHE_VERSION = "v10";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const PAGE_CACHE_PREFIX = `${CACHE_PREFIX}-pages-${CACHE_VERSION}-`;
const ACCOUNT_META_CACHE = `${CACHE_PREFIX}-account-${CACHE_VERSION}`;
const ACCOUNT_META_URL = "/__audio-novel-account-scope__";
const ANONYMOUS_ACCOUNT_SCOPE = "anonymous";

// Assets críticos para funcionamento offline
const STATIC_ASSETS = [
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/apple-touch-icon.png",
  "/icon.png",
  "/icons/icon-72x72.png",
  "/icons/icon-96x96.png",
  "/icons/icon-128x128.png",
  "/icons/icon-144x144.png",
  "/icons/icon-152x152.png",
  "/icons/icon-180x180.png",
  "/icons/icon-192x192.png",
  "/icons/icon-384x384.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-512x512.png",
  "/offline-fallback.html",
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Cache install error:", err);
        return self.skipWaiting();
      }),
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    migratePreviousOfflineCache()
      .catch(() => undefined)
      .then(() => caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(CACHE_PREFIX) &&
                key !== CACHE_NAME &&
                key !== ACCOUNT_META_CACHE &&
                !key.startsWith(PAGE_CACHE_PREFIX),
            )
            .map((key) => caches.delete(key)),
        ),
      ))
      .then(() => self.clients.claim()),
  );
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "GET_VERSION") {
    event.ports?.[0]?.postMessage({ version: CACHE_VERSION, revision: RELEASE_REVISION });
  }

  if (event.data?.type === "SET_ACCOUNT_SCOPE") {
    const replyPort = event.ports?.[0];
    event.waitUntil(
      setAccountScope(event.data.scope)
        .then(() => replyPort?.postMessage({ ok: true, scope: normalizeAccountScope(event.data.scope) }))
        .catch(() => replyPort?.postMessage({ ok: false, error: "Nao foi possivel definir a conta offline." })),
    );
  }

  if (event.data?.type === "PREPARE_OFFLINE_PAGE") {
    const replyPort = event.ports?.[0];
    event.waitUntil(
      prepareOfflinePage(event.data.scope)
        .then(() => replyPort?.postMessage({ ok: true }))
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Nao foi possivel preparar a pagina offline.";
          replyPort?.postMessage({ ok: false, error: message });
        }),
    );
  }
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Ignorar métodos não-GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Ignorar origens externas
  if (url.origin !== self.location.origin) return;

  // Ignorar APIs - sempre buscar da rede
  if (url.pathname.startsWith("/api/")) return;

  // Ignorar manifest - sempre buscar da rede
  if (url.pathname === "/manifest.webmanifest") return;

  // Chunks do Next possuem hash no nome e podem ser reutilizados com seguranca.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Ignorar os demais arquivos internos do Next.js.
  if (url.pathname.startsWith("/_next/")) return;

  // Assets estáticos (imagens, fontes, scripts, estilos)
  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Rotas de leitura aprovadas usam rede primeiro e cache isolado por conta.
  if (request.mode === "navigate") {
    event.respondWith(
      url.pathname === "/offline"
        ? accountScopedOfflinePage(request, event)
        : isCacheableNavigationPath(url.pathname)
          ? networkFirstWithPageCache(request, event)
          : networkOnlyWithOfflineFallback(request),
    );
    return;
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function isStaticAsset(request, url) {
  const staticDests = ["font", "image", "script", "style", "manifest", "worker"];
  if (staticDests.includes(request.destination)) return true;

  // Extensões de arquivo estático
  const staticExts = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".css", ".js"];
  return staticExts.some((ext) => url.pathname.endsWith(ext));
}

async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.status < 400) {
      try {
        await cache.put(request, response.clone());
      } catch {
        // Uma falha de armazenamento nao deve esconder uma resposta valida da rede.
      }
    }
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    return getOfflineFallback();
  }
}

function isCacheableNavigationPath(pathname) {
  return (
    pathname === "/" ||
    pathname === "/novels" ||
    pathname.startsWith("/novels/") ||
    pathname.startsWith("/chapters/") ||
    pathname === "/biblioteca"
  );
}

function getNavigationCacheKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete("_rsc");
  url.hash = "";
  return url.href;
}

async function networkFirstWithPageCache(request, event) {
  const scope = await getAccountScope();
  const cache = await caches.open(getAccountPageCacheName(scope));
  const cacheKey = getNavigationCacheKey(request);
  const cached = await cache.match(cacheKey);
  const networkTask = fetch(request).then(async (response) => {
    try {
      await publishNavigationPage(response.clone(), request, scope);
    } catch {
      // Uma resposta valida continua utilizavel mesmo se nao puder ser persistida.
    }
    return response;
  });

  event?.waitUntil?.(networkTask.then(() => undefined).catch(() => undefined));

  let timeoutId;
  const timeoutTask = new Promise((resolve) => {
    timeoutId = setTimeout(
      () => resolve(cached ?? getOfflineFallback()),
      4_000,
    );
  });

  try {
    const response = await Promise.race([networkTask, timeoutTask]);
    clearTimeout(timeoutId);
    return await response;
  } catch {
    clearTimeout(timeoutId);
    return cached ?? getOfflineFallback();
  }
}

async function publishNavigationPage(response, request, scope) {
  const requestUrl = new URL(request.url);
  const responseUrl = response.url ? new URL(response.url, self.location.origin) : requestUrl;
  const contentType = response.headers.get("Content-Type") ?? "";
  if (
    !response.ok ||
    responseUrl.origin !== self.location.origin ||
    responseUrl.pathname !== requestUrl.pathname ||
    !contentType.toLowerCase().includes("text/html")
  ) {
    return;
  }

  const html = await response.clone().text();
  if (extractOfflineAccountScope(html) !== scope) return;
  if (requestUrl.pathname === "/biblioteca" && scope === ANONYMOUS_ACCOUNT_SCOPE) return;
  if (scope !== (await getAccountScope())) return;

  const cache = await caches.open(getAccountPageCacheName(scope));
  await cache.put(getNavigationCacheKey(request), response);
}

async function accountScopedOfflinePage(request, event, timeoutMs = 4_000) {
  const scope = await getAccountScope();
  if (scope === ANONYMOUS_ACCOUNT_SCOPE) {
    return networkOnlyWithOfflineFallback(request);
  }

  const cache = await caches.open(getAccountPageCacheName(scope));
  const cached = await cache.match(request);
  const networkTask = fetch(request);
  const refreshTask = networkTask
    .then(async (response) => {
      if (!response.ok) return;
      try {
        await publishOfflinePage(response.clone(), scope);
      } catch {
        // Mantem o shell anterior quando a resposta nao puder ser publicada com seguranca.
      }
    })
    .catch(() => undefined);

  event?.waitUntil?.(refreshTask);
  if (cached) return cached;

  let timeoutId;
  const timeoutTask = new Promise((resolve) => {
    timeoutId = setTimeout(
      () => resolve(getOfflineFallback()),
      timeoutMs,
    );
  });

  try {
    const response = await Promise.race([networkTask, timeoutTask]);
    clearTimeout(timeoutId);
    return await response;
  } catch {
    clearTimeout(timeoutId);
    return getOfflineFallback();
  }
}

function getAccountPageCacheName(scope) {
  return `${PAGE_CACHE_PREFIX}${encodeURIComponent(scope)}`;
}

async function migratePreviousOfflineCache() {
  const previousAccountCache = await caches.open(
    `${CACHE_PREFIX}-account-${PREVIOUS_CACHE_VERSION}`,
  );
  const previousScopeResponse = await previousAccountCache.match(ACCOUNT_META_URL);
  if (!previousScopeResponse) return;

  const scope = normalizeAccountScope(await previousScopeResponse.text());
  if (scope === ANONYMOUS_ACCOUNT_SCOPE) return;
  const previousPageCache = await caches.open(
    `${CACHE_PREFIX}-pages-${PREVIOUS_CACHE_VERSION}-${encodeURIComponent(scope)}`,
  );
  const cachedPage = await previousPageCache.match("/offline");
  if (!cachedPage) return;
  const html = await cachedPage.clone().text();
  if (extractOfflineAccountScope(html) !== scope) return;

  const accountCache = await caches.open(ACCOUNT_META_CACHE);
  await accountCache.put(ACCOUNT_META_URL, new Response(scope));
  const pageCache = await caches.open(getAccountPageCacheName(scope));
  await pageCache.put("/offline", cachedPage);
}

async function setAccountScope(value) {
  const scope = normalizeAccountScope(value);
  const cache = await caches.open(ACCOUNT_META_CACHE);
  await cache.put(ACCOUNT_META_URL, new Response(scope));
}

async function getAccountScope() {
  const cache = await caches.open(ACCOUNT_META_CACHE);
  const response = await cache.match(ACCOUNT_META_URL);
  return response ? response.text() : ANONYMOUS_ACCOUNT_SCOPE;
}

function normalizeAccountScope(value) {
  return typeof value === "string" && value.trim() ? value.trim() : ANONYMOUS_ACCOUNT_SCOPE;
}

async function prepareOfflinePage(requestedScope) {
  const scope = normalizeAccountScope(requestedScope);
  if (scope === ANONYMOUS_ACCOUNT_SCOPE || scope !== (await getAccountScope())) {
    throw new Error("Conta offline invalida.");
  }

  const response = await fetch("/offline", {
    credentials: "include",
    headers: { Accept: "text/html" },
    redirect: "follow",
  });
  await publishOfflinePage(response, scope);
}

async function publishOfflinePage(response, scope) {
  const responseUrl = response.url ? new URL(response.url, self.location.origin) : null;
  const contentType = response.headers.get("Content-Type") ?? "";

  if (
    !response.ok ||
    responseUrl?.origin !== self.location.origin ||
    responseUrl.pathname !== "/offline" ||
    !contentType.toLowerCase().includes("text/html")
  ) {
    throw new Error("Pagina offline indisponivel.");
  }

  const html = await response.clone().text();
  const responseScope = extractOfflineAccountScope(html);
  if (!responseScope || responseScope !== scope) {
    throw new Error("Conta offline invalida.");
  }

  const assetUrls = extractNextStaticAssetUrls(html);
  if (assetUrls.length === 0) {
    throw new Error("Arquivos da pagina offline nao foram encontrados.");
  }

  const staticCache = await caches.open(CACHE_NAME);
  await Promise.all(
    assetUrls.map(async (assetUrl) => {
      const assetResponse = await fetch(assetUrl, { credentials: "same-origin" });
      const assetContentType = assetResponse.headers.get("Content-Type") ?? "";
      if (!assetResponse.ok || assetContentType.toLowerCase().includes("text/html")) {
        throw new Error("Um arquivo da pagina offline nao esta disponivel.");
      }
      await staticCache.put(assetUrl, assetResponse);
    }),
  );

  const pageCache = await caches.open(getAccountPageCacheName(scope));
  if (scope !== (await getAccountScope())) {
    throw new Error("Conta offline invalida.");
  }
  await pageCache.put("/offline", response);
}

function extractOfflineAccountScope(html) {
  const metaTag = html.match(/<meta\b[^>]*\bname=["']audio-novel-account-scope["'][^>]*>/i)?.[0];
  return metaTag?.match(/\bcontent=["']([^"']+)["']/i)?.[1] ?? "";
}

function extractNextStaticAssetUrls(html) {
  const assetUrls = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;

  for (const match of html.matchAll(attributePattern)) {
    const rawUrl = match[1].replaceAll("&amp;", "&");
    const url = new URL(rawUrl, self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
      assetUrls.add(url.href);
    }
  }

  return Array.from(assetUrls);
}

async function getOfflineFallback() {
  const cache = await caches.open(CACHE_NAME);
  const offlinePage = await cache.match("/offline-fallback.html");
  if (offlinePage) return offlinePage;

  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - Audio Novel BR</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#03191c;color:#e4e4e7;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center}h1{font-size:1.5rem;font-weight:900;margin-bottom:.75rem;color:#22d3dc}p{color:#a1a1aa;max-width:28rem;line-height:1.6;margin-bottom:1.5rem}button{background:#18b7bd;color:#021114;border:none;padding:.75rem 1.5rem;border-radius:9999px;font-weight:900;cursor:pointer}</style></head><body><h1>Você está offline</h1><p>Conecte-se à internet para acessar o catálogo completo de novels.</p><button onclick="window.location.reload()">Tentar novamente</button></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
