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
  migratePreviousOfflineCache(): Promise<void>;
  accountScopedOfflinePage(
    request: Request,
    event?: { waitUntil(promise: Promise<unknown>): void },
    timeoutMs?: number,
  ): Promise<Response>;
  networkOnlyWithOfflineFallback(request: Request, timeoutMs?: number): Promise<Response>;
  networkFirstWithPageCache(request: Request, event?: { waitUntil(promise: Promise<unknown>): void }, timeoutMs?: number): Promise<Response>;
  networkFirstChapterPage(request: Request, event?: { waitUntil(promise: Promise<unknown>): void }, timeoutMs?: number): Promise<Response>;
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
      const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
      await accountCache.put("/__audio-novel-account-scope__", new Response("account-b"));
      return responseWithUrl(offlineHtml("account-b", "NEW-B"), `${ORIGIN}/offline`, "text/html");
    }
    return responseWithUrl("body{}", url.href, "text/css");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await pageCache.put("/offline", responseWithUrl(offlineHtml("account-a", "OLD-A"), `${ORIGIN}/offline`, "text/html"));

  await assert.rejects(created.runtime.prepareOfflinePage("account-a"), /Conta offline invalida/);
  assert.match(await (await pageCache.match("/offline"))!.text(), /OLD-A/);
});

test("navegacao online nao substitui shell valido com html de outra conta", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
    await accountCache.put("/__audio-novel-account-scope__", new Response("account-b"));
    return responseWithUrl(offlineHtml("account-b", "NEW-B"), `${ORIGIN}/offline`, "text/html");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await pageCache.put("/offline", responseWithUrl(offlineHtml("account-a", "OLD-A"), `${ORIGIN}/offline`, "text/html"));

  const networkResponse = await created.runtime.accountScopedOfflinePage(new Request(`${ORIGIN}/offline`));

  assert.match(await networkResponse.text(), /OLD-A/);
  assert.match(await (await pageCache.match("/offline"))!.text(), /OLD-A/);
});

test("atualizacao do worker preserva o shell offline da versao anterior", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("unused");
  }, caches);
  const previousAccountCache = await caches.open("audio-novel-br-pwa-account-v14");
  await previousAccountCache.put(
    "/__audio-novel-account-scope__",
    new Response("account-a"),
  );
  const previousPageCache = await caches.open("audio-novel-br-pwa-pages-v14-account-a");
  await previousPageCache.put(
    "/offline",
    responseWithUrl(offlineHtml("account-a", "OLD-A"), `${ORIGIN}/offline`, "text/html"),
  );
  const previousStaticCache = await caches.open("audio-novel-br-pwa-v14");
  await previousStaticCache.put(
    `${ORIGIN}/_next/static/css/app.css`,
    responseWithUrl("body{}", `${ORIGIN}/_next/static/css/app.css`, "text/css"),
  );

  await created.runtime.migratePreviousOfflineCache();

  const currentAccountCache = await caches.open("audio-novel-br-pwa-account-v15");
  assert.equal(
    await (await currentAccountCache.match("/__audio-novel-account-scope__"))!.text(),
    "account-a",
  );
  const currentPageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  assert.match(await (await currentPageCache.match("/offline"))!.text(), /OLD-A/);
  const currentStaticCache = await caches.open("audio-novel-br-pwa-v15");
  assert.equal(
    await (await currentStaticCache.match(`${ORIGIN}/_next/static/css/app.css`))!.text(),
    "body{}",
  );
});

test("pagina offline em cache abre sem aguardar uma rede lenta", async () => {
  const caches = new MemoryCacheStorage();
  const pendingNetwork = new Promise<Response>(() => undefined);
  const created = createRuntime(() => pendingNetwork, caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await pageCache.put(
    "/offline",
    responseWithUrl(offlineHtml("account-a", "OLD-A"), `${ORIGIN}/offline`, "text/html"),
  );
  const backgroundTasks: Promise<unknown>[] = [];

  const responseResult = await Promise.race([
    created.runtime.accountScopedOfflinePage(
      new Request(`${ORIGIN}/offline`),
      { waitUntil: (promise) => backgroundTasks.push(promise) },
    ),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
  ]);

  assert.notEqual(responseResult, "timeout");
  assert.match(await (responseResult as Response).text(), /OLD-A/);
  assert.equal(backgroundTasks.length, 1);
});

test("pagina offline sem shell e sem rede mostra o fallback", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const staticCache = await caches.open("audio-novel-br-pwa-v15");
  await staticCache.put(
    "/offline-fallback.html",
    responseWithUrl("FALLBACK", `${ORIGIN}/offline-fallback.html`, "text/html"),
  );

  const response = await created.runtime.accountScopedOfflinePage(
    new Request(`${ORIGIN}/offline`),
  );

  assert.equal(await response.text(), "FALLBACK");
});

test("pagina offline sem shell aguarda a rede lenta em vez de mostrar fallback", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(() => new Promise<Response>(() => undefined), caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));

  const responseResult = await Promise.race([
    created.runtime.accountScopedOfflinePage(new Request(`${ORIGIN}/offline`)),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
  ]);

  assert.equal(responseResult, "timeout");
});

test("pagina visitada com rede lenta aguarda a resposta da rede", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(() => new Promise<Response>(() => undefined), caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await pageCache.put(
    `${ORIGIN}/biblioteca`,
    responseWithUrl(offlineHtml("account-a", "BIBLIOTECA-ANTIGA"), `${ORIGIN}/biblioteca`, "text/html"),
  );

  const responseResult = await Promise.race([
    created.runtime.networkFirstWithPageCache(new Request(`${ORIGIN}/biblioteca`)),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
  ]);

  assert.equal(responseResult, "timeout");
});

test("inicializacao fria presa mostra recuperacao em vez de uma janela vazia", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(() => new Promise<Response>(() => undefined), caches);
  const staticCache = await caches.open("audio-novel-br-pwa-v15");
  await staticCache.put(
    "/loading-fallback.html",
    responseWithUrl("RECUPERACAO", `${ORIGIN}/loading-fallback.html`, "text/html"),
  );

  const response = await created.runtime.networkFirstWithPageCache(
    new Request(`${ORIGIN}/`),
    undefined,
    5,
  );

  assert.equal(await response.text(), "RECUPERACAO");
});

test("rede presa usa html cacheado somente quando seus chunks estao disponiveis", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(() => new Promise<Response>(() => undefined), caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await pageCache.put(
    `${ORIGIN}/biblioteca`,
    responseWithUrl(
      offlineHtml("account-a", "BIBLIOTECA-COMPATIVEL"),
      `${ORIGIN}/biblioteca`,
      "text/html",
    ),
  );
  const staticCache = await caches.open("audio-novel-br-pwa-v15");
  await staticCache.put(
    `${ORIGIN}/_next/static/css/app.css`,
    responseWithUrl("body{}", `${ORIGIN}/_next/static/css/app.css`, "text/css"),
  );

  const response = await created.runtime.networkFirstWithPageCache(
    new Request(`${ORIGIN}/biblioteca`),
    undefined,
    5,
  );

  assert.match(await response.text(), /BIBLIOTECA-COMPATIVEL/);
});

test("rede presa rejeita html cacheado quando falta um chunk da versao", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(() => new Promise<Response>(() => undefined), caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await pageCache.put(
    `${ORIGIN}/biblioteca`,
    responseWithUrl(
      offlineHtml("account-a", "BIBLIOTECA-INCOMPATIVEL"),
      `${ORIGIN}/biblioteca`,
      "text/html",
    ),
  );
  const staticCache = await caches.open("audio-novel-br-pwa-v15");
  await staticCache.put(
    "/loading-fallback.html",
    responseWithUrl("RECUPERACAO", `${ORIGIN}/loading-fallback.html`, "text/html"),
  );

  const response = await created.runtime.networkFirstWithPageCache(
    new Request(`${ORIGIN}/biblioteca`),
    undefined,
    5,
  );

  assert.equal(await response.text(), "RECUPERACAO");
});

test("pagina visitada abre do cache sem redirecionar para offline", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
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

test("pagina de capitulo em rede lenta nao abre cache com posicao antiga", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(() => new Promise<Response>(() => undefined), caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await pageCache.put(
    `${ORIGIN}/chapters/cap-1`,
    responseWithUrl(offlineHtml("account-a", "CAPITULO-ANTIGO"), `${ORIGIN}/chapters/cap-1`, "text/html"),
  );

  const responseResult = await Promise.race([
    created.runtime.networkFirstChapterPage(new Request(`${ORIGIN}/chapters/cap-1`)),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
  ]);

  assert.equal(responseResult, "timeout");
});

test("capitulo preso mostra recuperacao sem restaurar uma posicao antiga", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(() => new Promise<Response>(() => undefined), caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await pageCache.put(
    `${ORIGIN}/chapters/cap-1`,
    responseWithUrl(
      offlineHtml("account-a", "CAPITULO-ANTIGO"),
      `${ORIGIN}/chapters/cap-1`,
      "text/html",
    ),
  );
  const staticCache = await caches.open("audio-novel-br-pwa-v15");
  await staticCache.put(
    "/loading-fallback.html",
    responseWithUrl("RECUPERACAO", `${ORIGIN}/loading-fallback.html`, "text/html"),
  );

  const response = await created.runtime.networkFirstChapterPage(
    new Request(`${ORIGIN}/chapters/cap-1`),
    undefined,
    5,
  );

  assert.equal(await response.text(), "RECUPERACAO");
});

test("pagina de capitulo sem rede abre do cache da conta", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await pageCache.put(
    `${ORIGIN}/chapters/cap-1`,
    responseWithUrl(offlineHtml("account-a", "CAPITULO-A"), `${ORIGIN}/chapters/cap-1`, "text/html"),
  );

  const response = await created.runtime.networkFirstChapterPage(new Request(`${ORIGIN}/chapters/cap-1`));

  assert.equal(response.status, 200);
  assert.match(await response.text(), /CAPITULO-A/);
});

test("pagina inedita sem rede mostra fallback estatico e nao redireciona para offline", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const staticCache = await caches.open("audio-novel-br-pwa-v15");
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
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));

  const response = await created.runtime.networkFirstWithPageCache(
    new Request(`${ORIGIN}/novels`),
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /ONLINE/);
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  assert.match(await (await pageCache.match(`${ORIGIN}/novels`))!.text(), /ONLINE/);
});

test("biblioteca em cache nunca atravessa contas", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);
  const accountCache = await caches.open("audio-novel-br-pwa-account-v15");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-b"));
  const accountAPages = await caches.open("audio-novel-br-pwa-pages-v15-account-a");
  await accountAPages.put(
    `${ORIGIN}/biblioteca`,
    responseWithUrl(offlineHtml("account-a", "LIBRARY-A"), `${ORIGIN}/biblioteca`, "text/html"),
  );
  const staticCache = await caches.open("audio-novel-br-pwa-v15");
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
  const staticCache = await created.caches.open("audio-novel-br-pwa-v15");
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
