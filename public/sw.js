// Audio Novel BR - Service Worker v6
// Estratégia: cache estático compartilhado e página offline isolada por conta.

const CACHE_PREFIX = "audio-novel-br-pwa";
const CACHE_VERSION = "v6";
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
    caches
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
      )
      .then(() => self.clients.claim()),
  );
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "GET_VERSION") {
    event.ports?.[0]?.postMessage({ version: CACHE_VERSION });
  }

  if (event.data?.type === "SET_ACCOUNT_SCOPE") {
    event.waitUntil(setAccountScope(event.data.scope));
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

  // Ignorar arquivos internos do Next.js; o navegador deve sempre buscar os chunks atuais.
  if (url.pathname.startsWith("/_next/")) return;

  // Assets estáticos (imagens, fontes, scripts, estilos)
  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navegações privadas nunca são persistidas. Apenas /offline usa cache por conta.
  if (request.mode === "navigate") {
    event.respondWith(
      url.pathname !== "/offline"
        ? networkOnlyWithOfflineFallback(request)
        : accountScopedOfflinePage(request),
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
      cache.put(request, response.clone()).catch(() => undefined);
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

async function accountScopedOfflinePage(request) {
  const scope = await getAccountScope();
  if (scope === ANONYMOUS_ACCOUNT_SCOPE) {
    return networkOnlyWithOfflineFallback(request);
  }

  const cache = await caches.open(getAccountPageCacheName(scope));

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return getOfflineFallback();
  }
}

function getAccountPageCacheName(scope) {
  return `${PAGE_CACHE_PREFIX}${encodeURIComponent(scope)}`;
}

async function setAccountScope(value) {
  const scope = typeof value === "string" && value.trim() ? value.trim() : ANONYMOUS_ACCOUNT_SCOPE;
  const cache = await caches.open(ACCOUNT_META_CACHE);
  await cache.put(ACCOUNT_META_URL, new Response(scope));
}

async function getAccountScope() {
  const cache = await caches.open(ACCOUNT_META_CACHE);
  const response = await cache.match(ACCOUNT_META_URL);
  return response ? response.text() : ANONYMOUS_ACCOUNT_SCOPE;
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
