import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";

const ORIGIN = "https://app.test";
const serviceWorkerSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const offlinePageSource = readFileSync(join(process.cwd(), "src", "app", "offline", "page.tsx"), "utf8");
const layoutSource = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

class MemoryCache {
  entries = new Map<string, Response>();

  async match(request: RequestInfo | URL) {
    return this.entries.get(toCacheKey(request))?.clone();
  }

  async put(request: RequestInfo | URL, response: Response) {
    this.entries.set(toCacheKey(request), response.clone());
  }

  async addAll() {}
}

class MemoryCacheStorage {
  stores = new Map<string, MemoryCache>();

  async open(name: string) {
    const existing = this.stores.get(name);
    if (existing) return existing;
    const cache = new MemoryCache();
    this.stores.set(name, cache);
    return cache;
  }

  async keys() {
    return Array.from(this.stores.keys());
  }

  async delete(name: string) {
    return this.stores.delete(name);
  }
}

type WorkerRuntime = {
  prepareOfflinePage(scope: string): Promise<void>;
  accountScopedOfflinePage(request: Request): Promise<Response>;
  networkOnlyWithOfflineFallback(request: Request): Promise<Response>;
  networkFirstWithPageCache(request: Request, event?: { waitUntil(promise: Promise<unknown>): void }): Promise<Response>;
  cacheFirst(request: Request): Promise<Response>;
  getNavigationCacheKey(request: Request): string;
  isCacheableNavigationPath(pathname: string): boolean;
};

function createRuntime(
  fetchImplementation: typeof fetch,
  caches = new MemoryCacheStorage(),
) {
  const listeners = new Map<string, (event: unknown) => void>();
  const context = {
    self: {
      location: { origin: ORIGIN },
      addEventListener(type: string, listener: (event: unknown) => void) {
        listeners.set(type, listener);
      },
      skipWaiting() {},
      clients: { claim() {} },
    },
    caches,
    fetch: fetchImplementation,
    Response,
    Request,
    URL,
    Set,
    Error,
    setTimeout,
    clearTimeout,
    console,
  };

  vm.runInNewContext(serviceWorkerSource, context);
  return { runtime: context as unknown as WorkerRuntime, caches };
}

function toCacheKey(request: RequestInfo | URL) {
  if (request instanceof Request) return request.url;
  return new URL(request.toString(), ORIGIN).href;
}

function responseWithUrl(body: string, url: string, contentType: string) {
  const response = new Response(body, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function offlineHtml(accountScope: string, marker: string) {
  return `<!doctype html><html><head><meta name="audio-novel-account-scope" content="${accountScope}"><link rel="stylesheet" href="/_next/static/css/app.css"></head><body>${marker}</body></html>`;
}

test("pagina offline renderiza a identidade autenticada para vincular o cache", () => {
  assert.match(
    offlinePageSource,
    /<meta name="audio-novel-account-scope" content=\{session\.user\.id\}/,
  );
});

test("layout publica o escopo da conta para validar paginas em cache", () => {
  assert.match(
    layoutSource,
    /<meta\s+name="audio-novel-account-scope"\s+content=\{activeSession\?\.user\?\.id \?\? "anonymous"\}/,
  );
});

test("service worker reconhece apenas as rotas de navegacao aprovadas", () => {
  const created = createRuntime(async () => {
    throw new TypeError("unused");
  });

  for (const pathname of ["/", "/novels", "/novels/teste", "/chapters/id", "/biblioteca"]) {
    assert.equal(created.runtime.isCacheableNavigationPath(pathname), true);
  }
  for (const pathname of ["/perfil", "/offline", "/admin", "/notificacoes"]) {
    assert.equal(created.runtime.isCacheableNavigationPath(pathname), false);
  }
});

test("chave de navegacao remove apenas o parametro interno RSC", () => {
  const created = createRuntime(async () => {
    throw new TypeError("unused");
  });

  assert.equal(
    created.runtime.getNavigationCacheKey(
      new Request(`${ORIGIN}/novels?tag=fantasia&_rsc=abc`),
    ),
    `${ORIGIN}/novels?tag=fantasia`,
  );
});

test("preparacao rejeita resposta de outra conta e preserva o html anterior", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async (request) => {
    const url = new URL(request.toString(), ORIGIN);
    if (url.pathname === "/offline") {
      const accountCache = await caches.open("audio-novel-br-pwa-account-v10");
      await accountCache.put("/__audio-novel-account-scope__", new Response("account-b"));
      return responseWithUrl(offlineHtml("account-b", "NEW-B"), `${ORIGIN}/offline`, "text/html");
    }
    return responseWithUrl("body{}", url.href, "text/css");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v10");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v10-account-a");
  await pageCache.put("/offline", responseWithUrl(offlineHtml("account-a", "OLD-A"), `${ORIGIN}/offline`, "text/html"));

  await assert.rejects(created.runtime.prepareOfflinePage("account-a"), /Conta offline invalida/);
  assert.match(await (await pageCache.match("/offline"))!.text(), /OLD-A/);
});

test("navegacao online nao substitui shell valido com html de outra conta", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    const accountCache = await caches.open("audio-novel-br-pwa-account-v10");
    await accountCache.put("/__audio-novel-account-scope__", new Response("account-b"));
    return responseWithUrl(offlineHtml("account-b", "NEW-B"), `${ORIGIN}/offline`, "text/html");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v10");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v10-account-a");
  await pageCache.put("/offline", responseWithUrl(offlineHtml("account-a", "OLD-A"), `${ORIGIN}/offline`, "text/html"));

  const networkResponse = await created.runtime.accountScopedOfflinePage(new Request(`${ORIGIN}/offline`));

  assert.match(await networkResponse.text(), /NEW-B/);
  assert.match(await (await pageCache.match("/offline"))!.text(), /OLD-A/);
});

test("pagina visitada abre do cache sem redirecionar para offline", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v10");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v10-account-a");
  await pageCache.put(
    `${ORIGIN}/`,
    responseWithUrl(offlineHtml("account-a", "HOME-A"), `${ORIGIN}/`, "text/html"),
  );

  const response = await created.runtime.networkFirstWithPageCache(
    new Request(`${ORIGIN}/`),
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /HOME-A/);
});

test("pagina inedita sem rede mostra fallback estatico e nao redireciona para offline", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v10");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const staticCache = await caches.open("audio-novel-br-pwa-v10");
  await staticCache.put(
    "/offline-fallback.html",
    responseWithUrl("FALLBACK", `${ORIGIN}/offline-fallback.html`, "text/html"),
  );

  const response = await created.runtime.networkFirstWithPageCache(
    new Request(`${ORIGIN}/novels/inedita`),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Location"), null);
  assert.equal(await response.text(), "FALLBACK");
});

test("navegacao online salva a pagina no cache da conta", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async (request) => {
    const url = new URL(request.toString(), ORIGIN);
    return responseWithUrl(offlineHtml("account-a", "ONLINE"), url.href, "text/html");
  }, caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v10");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));

  const response = await created.runtime.networkFirstWithPageCache(
    new Request(`${ORIGIN}/novels`),
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /ONLINE/);
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v10-account-a");
  assert.match(await (await pageCache.match(`${ORIGIN}/novels`))!.text(), /ONLINE/);
});

test("biblioteca em cache nunca atravessa contas", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v10");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-b"));
  const accountAPages = await caches.open("audio-novel-br-pwa-pages-v10-account-a");
  await accountAPages.put(
    `${ORIGIN}/biblioteca`,
    responseWithUrl(offlineHtml("account-a", "LIBRARY-A"), `${ORIGIN}/biblioteca`, "text/html"),
  );
  const staticCache = await caches.open("audio-novel-br-pwa-v10");
  await staticCache.put(
    "/offline-fallback.html",
    responseWithUrl("FALLBACK", `${ORIGIN}/offline-fallback.html`, "text/html"),
  );

  const response = await created.runtime.networkFirstWithPageCache(
    new Request(`${ORIGIN}/biblioteca`),
  );

  assert.equal(await response.text(), "FALLBACK");
});

test("cacheFirst aguarda a gravacao antes de concluir a resposta", async () => {
  const created = createRuntime(async () => responseWithUrl("body{}", `${ORIGIN}/_next/static/css/app.css`, "text/css"));
  const staticCache = await created.caches.open("audio-novel-br-pwa-v10");
  const originalPut = staticCache.put.bind(staticCache);
  let releaseWrite!: () => void;
  const writeGate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  let writeStarted = false;
  staticCache.put = async (request, response) => {
    writeStarted = true;
    await writeGate;
    await originalPut(request, response);
  };

  let resolved = false;
  const responsePromise = created.runtime
    .cacheFirst(new Request(`${ORIGIN}/_next/static/css/app.css`))
    .then((response) => {
      resolved = true;
      return response;
    });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writeStarted, true);
  assert.equal(resolved, false);
  releaseWrite();
  assert.equal((await responsePromise).status, 200);
});
