const CACHE_PREFIX = "audio-novel-br-pwa";
const CACHE_NAME = `${CACHE_PREFIX}-v3`;
const STATIC_ASSETS = [
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-512x512.png",
  "/offline-fallback.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/manifest.webmanifest") return;
  if (url.pathname.startsWith("/_next/")) return;

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }
});

function isStaticAssetRequest(request, url) {
  if (url.pathname.startsWith("/_next/")) return false;
  return ["font", "image", "script", "style"].includes(request.destination);
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const offlinePage = await cache.match("/offline-fallback.html");
    if (offlinePage) return offlinePage;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
