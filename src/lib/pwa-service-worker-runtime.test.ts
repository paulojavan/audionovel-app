import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";

const ORIGIN = "https://app.test";
const serviceWorkerSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const offlinePageSource = readFileSync(join(process.cwd(), "src", "app", "offline", "page.tsx"), "utf8");

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
  cacheFirst(request: Request): Promise<Response>;
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

test("preparacao rejeita resposta de outra conta e preserva o html anterior", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async (request) => {
    const url = new URL(request.toString(), ORIGIN);
    if (url.pathname === "/offline") {
      const accountCache = await caches.open("audio-novel-br-pwa-account-v7");
      await accountCache.put("/__audio-novel-account-scope__", new Response("account-b"));
      return responseWithUrl(offlineHtml("account-b", "NEW-B"), `${ORIGIN}/offline`, "text/html");
    }
    return responseWithUrl("body{}", url.href, "text/css");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v7");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v7-account-a");
  await pageCache.put("/offline", responseWithUrl(offlineHtml("account-a", "OLD-A"), `${ORIGIN}/offline`, "text/html"));

  await assert.rejects(created.runtime.prepareOfflinePage("account-a"), /Conta offline invalida/);
  assert.match(await (await pageCache.match("/offline"))!.text(), /OLD-A/);
});

test("navegacao online nao substitui shell valido com html de outra conta", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    const accountCache = await caches.open("audio-novel-br-pwa-account-v7");
    await accountCache.put("/__audio-novel-account-scope__", new Response("account-b"));
    return responseWithUrl(offlineHtml("account-b", "NEW-B"), `${ORIGIN}/offline`, "text/html");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v7");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v7-account-a");
  await pageCache.put("/offline", responseWithUrl(offlineHtml("account-a", "OLD-A"), `${ORIGIN}/offline`, "text/html"));

  const networkResponse = await created.runtime.accountScopedOfflinePage(new Request(`${ORIGIN}/offline`));

  assert.match(await networkResponse.text(), /NEW-B/);
  assert.match(await (await pageCache.match("/offline"))!.text(), /OLD-A/);
});

test("abertura pela raiz sem rede redireciona para o shell offline da conta ativa", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v7");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v7-account-a");
  await pageCache.put(
    "/offline",
    responseWithUrl(offlineHtml("account-a", "OFFLINE-A"), `${ORIGIN}/offline`, "text/html"),
  );

  const response = await created.runtime.networkOnlyWithOfflineFallback(
    new Request(`${ORIGIN}/`),
  );

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), `${ORIGIN}/offline`);
});

test("abertura sem rede mantem o fallback quando a conta nao possui shell offline", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v7");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const staticCache = await caches.open("audio-novel-br-pwa-v7");
  await staticCache.put(
    "/offline-fallback.html",
    responseWithUrl("FALLBACK", `${ORIGIN}/offline-fallback.html`, "text/html"),
  );

  const response = await created.runtime.networkOnlyWithOfflineFallback(
    new Request(`${ORIGIN}/`),
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "FALLBACK");
});

test("navegacao comum continua usando a resposta da rede quando online", async () => {
  const created = createRuntime(async (request) => {
    const url = new URL(request.toString(), ORIGIN);
    return responseWithUrl("ONLINE", url.href, "text/html");
  });

  const response = await created.runtime.networkOnlyWithOfflineFallback(
    new Request(`${ORIGIN}/`),
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ONLINE");
});

test("cacheFirst aguarda a gravacao antes de concluir a resposta", async () => {
  const created = createRuntime(async () => responseWithUrl("body{}", `${ORIGIN}/_next/static/css/app.css`, "text/css"));
  const staticCache = await created.caches.open("audio-novel-br-pwa-v7");
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
