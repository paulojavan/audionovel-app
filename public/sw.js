const APP_CACHE = "audio-novel-br-app-v1";
const OFFLINE_URLS = ["/offline.html", "/offline-app.js", "/logo-audio-novel-br.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.mode === "navigate" && url.pathname === "/offline") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(APP_CACHE);
        return cache.match("/offline.html");
      }),
    );
    return;
  }

  if (OFFLINE_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
