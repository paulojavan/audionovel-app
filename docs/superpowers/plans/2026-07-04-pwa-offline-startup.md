# PWA Offline Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o PWA aberto sem internet encaminhar contas com um shell offline salvo para `/offline`, mantendo o fallback genérico quando não houver conteúdo preparado.

**Architecture:** O service worker continuará usando network-first nas navegações comuns. Somente após uma falha de rede ele consultará o cache da conta ativa; se `/offline` existir nesse cache, responderá com um redirecionamento para a rota offline, que continuará sendo servida pelo fluxo isolado por conta já existente.

**Tech Stack:** Service Worker API, Cache Storage API, TypeScript, Node test runner, `vm`.

---

### Task 1: Cobrir a abertura offline no runtime do service worker

**Files:**
- Modify: `src/lib/pwa-service-worker-runtime.test.ts`

- [ ] **Step 1: Expor a função de navegação no tipo do runtime de teste**

Adicionar `networkOnlyWithOfflineFallback(request: Request): Promise<Response>` ao tipo `WorkerRuntime`.

- [ ] **Step 2: Escrever os testes de regressão**

Adicionar testes que:

```ts
test("abertura pela raiz sem rede redireciona para o shell offline da conta ativa", async () => {
  const caches = new MemoryCacheStorage();
  const created = createRuntime(async () => {
    throw new TypeError("Failed to fetch");
  }, caches);

  const accountCache = await caches.open("audio-novel-br-pwa-account-v7");
  await accountCache.put("/__audio-novel-account-scope__", new Response("account-a"));
  const pageCache = await caches.open("audio-novel-br-pwa-pages-v7-account-a");
  await pageCache.put("/offline", responseWithUrl(offlineHtml("account-a", "OFFLINE-A"), `${ORIGIN}/offline`, "text/html"));

  const response = await created.runtime.networkOnlyWithOfflineFallback(new Request(`${ORIGIN}/`));

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), `${ORIGIN}/offline`);
});
```

Também cobrir que uma conta sem shell recebe `offline-fallback.html` e que uma navegação com rede continua devolvendo sua resposta original.

- [ ] **Step 3: Executar o teste e confirmar RED**

Run: `npx tsx --test src/lib/pwa-service-worker-runtime.test.ts`

Expected: FAIL no teste de abertura pela raiz porque a implementação atual retorna o fallback genérico com status `200`, não o redirecionamento `302`.

### Task 2: Encaminhar para o shell offline da conta ativa

**Files:**
- Modify: `public/sw.js`
- Test: `src/lib/pwa-service-worker-runtime.test.ts`

- [ ] **Step 1: Implementar a consulta mínima ao cache da conta**

Alterar o `catch` de `networkOnlyWithOfflineFallback` para tentar um redirecionamento seguro antes do fallback:

```js
async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const offlineRedirect = await getAccountOfflineRedirect();
    return offlineRedirect ?? getOfflineFallback();
  }
}

async function getAccountOfflineRedirect() {
  const scope = await getAccountScope();
  if (scope === ANONYMOUS_ACCOUNT_SCOPE) return null;

  const cache = await caches.open(getAccountPageCacheName(scope));
  const offlinePage = await cache.match("/offline");
  if (!offlinePage) return null;

  return Response.redirect(new URL("/offline", self.location.origin).href, 302);
}
```

- [ ] **Step 2: Executar os testes PWA e confirmar GREEN**

Run: `npx tsx --test src/lib/pwa-offline.test.ts src/lib/pwa-service-worker.test.ts src/lib/pwa-service-worker-runtime.test.ts`

Expected: todos os testes passam.

- [ ] **Step 3: Revisar o diff focado**

Run: `git diff --check -- public/sw.js src/lib/pwa-service-worker-runtime.test.ts`

Expected: nenhuma saída e exit code `0`.

### Task 3: Verificação integral

**Files:**
- Verify: `public/sw.js`
- Verify: `src/lib/pwa-service-worker-runtime.test.ts`

- [ ] **Step 1: Executar toda a suíte**

Run: `npm test`

Expected: exit code `0`, sem testes falhando.

- [ ] **Step 2: Executar lint**

Run: `npm run lint`

Expected: exit code `0`.

- [ ] **Step 3: Executar build**

Run: `npm run build`

Expected: exit code `0`; avisos de conexão Prisma/Aiven durante prerenderização podem aparecer sem invalidar o build.

- [ ] **Step 4: Conferir o diff final**

Run: `git diff -- public/sw.js src/lib/pwa-service-worker-runtime.test.ts`

Expected: apenas a lógica de redirecionamento offline e os testes correspondentes.
