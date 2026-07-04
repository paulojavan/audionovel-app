# PWA Offline Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar automaticamente a rota `/offline` e seus chunks após salvar um áudio, mantendo Tailwind e player disponíveis sem rede e isolados por conta.

**Architecture:** Um helper cliente envia `PREPARE_OFFLINE_PAGE` ao service worker e aguarda confirmação por `MessageChannel`. O worker busca o HTML autenticado, armazena seus chunks imutáveis de `/_next/static/` e só então publica o HTML no cache privado da conta; chunks já carregados também passam a usar cache-first.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, Service Worker/Cache API, IndexedDB, Node test runner.

---

## Estrutura de arquivos

- Criar `src/lib/pwa-offline.ts`: protocolo cliente para preparar o shell e aguardar confirmação.
- Criar `src/lib/pwa-offline.test.ts`: testes unitários do protocolo.
- Modificar `public/sw.js`: cache v7, chunks do Next e preparação atômica do shell por conta.
- Modificar `src/lib/pwa-service-worker.test.ts`: regressões estruturais do worker.
- Modificar `src/components/offline-chapter-button.tsx`: preparar shell após persistir áudio e permitir nova tentativa sem baixar novamente.
- Criar `src/lib/offline-chapter-button-wiring.test.ts`: regressão da ordem e do tratamento de falha.

### Task 1: Protocolo cliente para preparação

**Files:**
- Create: `src/lib/pwa-offline.ts`
- Create: `src/lib/pwa-offline.test.ts`

- [ ] **Step 1: Escrever testes que exijam escopo normalizado, espera por `ready`, mensagem e resposta**

```ts
test("prepareOfflinePage waits for the worker and resolves its acknowledgement", async () => {
  const calls: unknown[] = [];
  const active = {
    postMessage(message: unknown, ports: readonly MessagePort[]) {
      calls.push(message);
      ports[0].postMessage({ ok: true });
    },
  };

  await prepareOfflinePage(" user-1 ", {
    controller: null,
    ready: Promise.resolve({ active }),
  });

  assert.deepEqual(calls, [{ type: "PREPARE_OFFLINE_PAGE", scope: "user-1" }]);
});
```

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `npx tsx --test src/lib/pwa-offline.test.ts`
Expected: FAIL porque `pwa-offline.ts` ainda não existe.

- [ ] **Step 3: Implementar `prepareOfflinePage` com timeout e erro retornado pelo worker**

```ts
export async function prepareOfflinePage(
  accountScope: string,
  serviceWorker = navigator.serviceWorker,
  timeoutMs = 15_000,
) {
  const registration = await serviceWorker.ready;
  const worker = serviceWorker.controller ?? registration.active;
  if (!worker) throw new Error("Service worker indisponivel.");

  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error("Tempo esgotado ao preparar a pagina offline.")), timeoutMs);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timer);
      channel.port1.close();
      data?.ok ? resolve() : reject(new Error(data?.error ?? "Nao foi possivel preparar a pagina offline."));
    };
    worker.postMessage(
      { type: "PREPARE_OFFLINE_PAGE", scope: normalizeAccountScope(accountScope) },
      [channel.port2],
    );
  });
}
```

- [ ] **Step 4: Executar testes e confirmar GREEN**

Run: `npx tsx --test src/lib/pwa-offline.test.ts`
Expected: todos PASS.

### Task 2: Preparação e cache do shell no service worker

**Files:**
- Modify: `public/sw.js`
- Modify: `src/lib/pwa-service-worker.test.ts`

- [ ] **Step 1: Alterar testes para exigir v7, cache-first de `/_next/static/` e `PREPARE_OFFLINE_PAGE`**

```ts
test("service worker prepara a pagina offline e seus chunks por conta", () => {
  assert.match(serviceWorkerSource, /CACHE_VERSION = "v7"/);
  assert.match(serviceWorkerSource, /PREPARE_OFFLINE_PAGE/);
  assert.match(serviceWorkerSource, /prepareOfflinePage/);
  assert.match(serviceWorkerSource, /extractNextStaticAssetUrls/);
  assert.match(serviceWorkerSource, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  assert.match(serviceWorkerSource, /event\.respondWith\(cacheFirst\(request\)\)/);
});
```

- [ ] **Step 2: Executar e confirmar RED**

Run: `npx tsx --test src/lib/pwa-service-worker.test.ts`
Expected: FAIL porque v6 ignora todo `/_next/` e não aceita a mensagem.

- [ ] **Step 3: Implementar a mensagem, extração local de chunks e publicação do HTML após os assets**

```js
if (event.data?.type === "PREPARE_OFFLINE_PAGE") {
  const replyPort = event.ports?.[0];
  event.waitUntil(
    prepareOfflinePage(event.data.scope)
      .then(() => replyPort?.postMessage({ ok: true }))
      .catch((error) => replyPort?.postMessage({ ok: false, error: error.message })),
  );
}

async function prepareOfflinePage(requestedScope) {
  const scope = normalizeAccountScope(requestedScope);
  if (scope === ANONYMOUS_ACCOUNT_SCOPE || scope !== await getAccountScope()) {
    throw new Error("Conta offline invalida.");
  }
  const response = await fetch("/offline", {
    credentials: "include",
    headers: { Accept: "text/html" },
    redirect: "follow",
  });
  if (!response.ok || new URL(response.url).pathname !== "/offline") {
    throw new Error("Pagina offline indisponivel.");
  }
  const html = await response.clone().text();
  const assets = extractNextStaticAssetUrls(html);
  const staticCache = await caches.open(CACHE_NAME);
  await Promise.all(assets.map(async (url) => {
    const assetResponse = await fetch(url, { credentials: "same-origin" });
    if (!assetResponse.ok) throw new Error(`Asset offline indisponivel: ${url}`);
    await staticCache.put(url, assetResponse);
  }));
  const pageCache = await caches.open(getAccountPageCacheName(scope));
  await pageCache.put("/offline", response);
}
```

- [ ] **Step 4: Executar testes e confirmar GREEN**

Run: `npx tsx --test src/lib/pwa-service-worker.test.ts`
Expected: todos PASS.

### Task 3: Integrar ao salvamento de áudio

**Files:**
- Modify: `src/components/offline-chapter-button.tsx`
- Create: `src/lib/offline-chapter-button-wiring.test.ts`

- [ ] **Step 1: Escrever teste de wiring para exigir preparação depois do IndexedDB**

```ts
test("offline button prepares the page after saving local metadata", () => {
  assert.match(source, /await saveOfflineItem\([\s\S]*?await prepareOfflinePage\(accountScope\)/);
  assert.match(source, /Audio salvo, mas a pagina offline ainda nao ficou pronta/);
});
```

- [ ] **Step 2: Executar e confirmar RED**

Run: `npx tsx --test src/lib/offline-chapter-button-wiring.test.ts`
Expected: FAIL porque o componente ainda não chama `prepareOfflinePage`.

- [ ] **Step 3: Integrar preparação e nova tentativa sem repetir o download**

```ts
const [audioSaved, setAudioSaved] = useState(false);

async function prepareSavedPage() {
  await prepareOfflinePage(accountScope);
  setReady(true);
  setMessage("Offline salvo.");
}

if (audioSaved) {
  try {
    await prepareSavedPage();
  } catch {
    setMessage("Audio salvo, mas a pagina offline ainda nao ficou pronta. Toque novamente para tentar.");
  }
  return;
}

await saveOfflineItem(accountScope, item);
setAudioSaved(true);
await prepareSavedPage();
```

- [ ] **Step 4: Executar testes focados e confirmar GREEN**

Run: `npx tsx --test src/lib/pwa-offline.test.ts src/lib/pwa-service-worker.test.ts src/lib/offline-chapter-button-wiring.test.ts`
Expected: todos PASS.

### Task 4: Verificação integral

**Files:**
- Verify only.

- [ ] **Step 1: Executar a suíte completa**

Run: `npm test`
Expected: zero falhas.

- [ ] **Step 2: Executar lint**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 3: Executar build de produção**

Run: `npm run build`
Expected: exit 0; avisos de banco inacessível podem aparecer sem invalidar o build.

- [ ] **Step 4: Revisar diff e confirmar os critérios de aceite**

Run: `git diff --check && git status -sb`
Expected: nenhum erro de whitespace e somente arquivos planejados modificados.
