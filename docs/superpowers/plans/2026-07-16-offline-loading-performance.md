# Offline Loading Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir capítulos offline imediatamente sem materializar blobs durante a listagem, agrupar renovações locais e servir o shell em cache sem esperar uma rede degradada.

**Architecture:** O catálogo local será lido em uma transação `readonly` que consulta metadados e somente chaves de áudio. A reprodução lerá apenas o registro selecionado, a reconciliação aplicará todas as renovações em uma transação e o service worker usará stale-while-revalidate para `/offline`.

**Tech Stack:** Next.js 16.2.9, React 19.2.4, TypeScript, IndexedDB, Web Crypto, Service Worker, Node test runner com `tsx`.

## Global Constraints

- Preservar downloads AES-GCM existentes sem migração ou novo download.
- Exibir a lista antes da validação integral do áudio escolhido.
- Não ler `AudioRecord.data` durante a montagem do catálogo.
- Manter caches, metadados, licenças e chaves isolados por conta.
- Fazer no máximo uma leitura de metadados e uma leitura de chaves para listar entre 1 e 100 itens.
- Usar quatro segundos como limite de rede quando não existir shell `/offline` em cache.
- Aplicar cinco minutos após sincronização bem-sucedida e 60 segundos após falha antes de nova tentativa.
- Escrever o teste e observar a falha antes de alterar cada comportamento de produção.
- Não modificar nem adicionar o diretório `.vscode/` existente.

---

### Task 1: Snapshot leve e lista imediata

**Files:**
- Create: `src/lib/offline-catalog.ts`
- Create: `src/lib/offline-catalog.test.ts`
- Modify: `src/lib/audio-cache.ts:126-166,443-476`
- Modify: `src/lib/offline-items.ts:19-42`
- Modify: `src/lib/offline-items.test.ts`
- Modify: `src/components/offline-listen-panel.tsx:8-73`
- Modify: `src/lib/offline-chapter-button-wiring.test.ts`

**Interfaces:**
- Produces: `selectAvailableOfflineItems(items, audioRecordIds, accountScope, now)`.
- Produces: `mergeAvailableOfflineItems(serverItems, localItems)`.
- Changes: `getSavedOfflineItems(accountScope)` e `getRecoverableOfflineItems(accountScope)` para snapshots sem blobs.
- Consumes later: `readOfflineCatalogSnapshot(accountScope)` dentro de `audio-cache.ts`.

- [ ] **Step 1: Write failing catalog and wiring tests**

```ts
test("seleciona apenas metadados vigentes que possuem chave de audio", () => {
  const items = [activeItem, expiredItem, missingItem];
  const ids = [getAudioCacheId("user-1", activeItem.chapterId, "offline")];
  assert.deepEqual(
    selectAvailableOfflineItems(items, ids, "user-1", NOW),
    [activeItem],
  );
});

test("lista offline nao revalida nem salva cada capitulo", () => {
  assert.doesNotMatch(panelSource, /hasValidEncryptedAudio/);
  assert.doesNotMatch(panelSource, /validItems\.map[\s\S]*saveOfflineItem/);
  assert.match(audioCacheSource, /objectStore\(STORE_NAME\)\.getAllKeys\(\)/);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx tsx --test src/lib/offline-catalog.test.ts src/lib/offline-items.test.ts src/lib/offline-chapter-button-wiring.test.ts`

Expected: FAIL because `offline-catalog.ts`, `selectAvailableOfflineItems`, and `mergeAvailableOfflineItems` do not exist and the panel still performs per-item validation and writes.

- [ ] **Step 3: Implement pure selection and one-transaction snapshot**

```ts
export function selectAvailableOfflineItems(
  items: OfflineItem[],
  audioRecordIds: Iterable<IDBValidKey | string>,
  accountScope: string,
  now = Date.now(),
) {
  const keys = new Set(Array.from(audioRecordIds, String));
  return items.filter((item) =>
    new Date(item.expiresAt).getTime() > now &&
    keys.has(getOfflineAudioRecordId(accountScope, item.chapterId)),
  );
}
```

In `audio-cache.ts`, open the database once and issue `offlineItems.getAll()` plus `audios.getAllKeys()` in the same `readonly` transaction. Filter account metadata after both requests finish. Do not call `readRecord`, `cleanupExpiredAudioCache`, or `getValidCachedRecord` from the snapshot.

```ts
async function readOfflineCatalogSnapshot(accountScope: string) {
  const db = await openAudioDb();
  return new Promise<{ items: OfflineItem[]; audioRecordIds: IDBValidKey[] }>((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_ITEMS_STORE_NAME, STORE_NAME], "readonly");
    const itemRequest = transaction.objectStore(OFFLINE_ITEMS_STORE_NAME).getAll();
    const keyRequest = transaction.objectStore(STORE_NAME).getAllKeys();
    transaction.oncomplete = () => resolve({
      items: filterScopedItems(itemRequest.result, accountScope),
      audioRecordIds: keyRequest.result,
    });
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}
```

Change the panel to call `getSavedOfflineItems`, merge only those local items with matching server metadata, and immediately set `availableItems`. Remove imports and loops for `hasValidEncryptedAudio` and `saveOfflineItem`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx tsx --test src/lib/offline-catalog.test.ts src/lib/offline-items.test.ts src/lib/audio-cache.test.ts src/lib/offline-chapter-button-wiring.test.ts`

Expected: PASS with a constant snapshot path and no per-chapter list validation.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/offline-catalog.ts src/lib/offline-catalog.test.ts src/lib/audio-cache.ts src/lib/offline-items.ts src/lib/offline-items.test.ts src/components/offline-listen-panel.tsx src/lib/offline-chapter-button-wiring.test.ts
git commit -m "perf: load offline catalog without audio blobs"
```

### Task 2: Leitura e remoção direcionadas na reprodução

**Files:**
- Modify: `src/lib/audio-cache.ts:390-440,479-510`
- Modify: `src/components/offline-listen-panel.tsx:89-137`
- Modify: `src/lib/audio-cache.test.ts`
- Modify: `src/lib/player-settings-wiring.test.ts`

**Interfaces:**
- Produces: `getSavedEncryptedAudioUrl(accountScope, chapterId)`.
- Produces: `removeOfflineItem(accountScope, chapterId)`.
- Preserves: `getEncryptedAudioUrl` for online downloads.

- [ ] **Step 1: Write failing targeted-playback tests**

```ts
test("reproducao offline usa somente a leitura direcionada", () => {
  assert.match(panelSource, /getSavedEncryptedAudioUrl\(accountScope, item\.chapterId\)/);
  const playBlock = extractPlayItem(panelSource);
  assert.doesNotMatch(playBlock, /hasValidEncryptedAudio/);
  assert.doesNotMatch(playBlock, /getEncryptedAudioUrl/);
});

test("validacao direcionada nao executa limpeza global", () => {
  const block = extractFunction(audioCacheSource, "getSavedEncryptedAudioUrl");
  assert.match(block, /readRecord/);
  assert.doesNotMatch(block, /cleanupExpiredAudioCache/);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx tsx --test src/lib/audio-cache.test.ts src/lib/player-settings-wiring.test.ts`

Expected: FAIL because the targeted playback function is absent and `playItem` still reads the selected record twice.

- [ ] **Step 3: Implement single-record playback and targeted deletion**

```ts
export async function getSavedEncryptedAudioUrl(accountScope: string, chapterId: string) {
  const record = await getValidCachedRecord(accountScope, chapterId, "offline");
  if (!record) throw new OfflineAudioUnavailableError();
  const key = await getCryptoKey(accountScope);
  return createObjectUrlFromRecord(record, key);
}

export async function removeOfflineItem(accountScope: string, chapterId: string) {
  const db = await openAudioDb();
  const transaction = db.transaction([OFFLINE_ITEMS_STORE_NAME, STORE_NAME], "readwrite");
  transaction.objectStore(OFFLINE_ITEMS_STORE_NAME).delete(buildOfflineItemStorageId(accountScope, chapterId));
  transaction.objectStore(STORE_NAME).delete(getAudioCacheId(accountScope, chapterId, "offline"));
  await waitForTransaction(transaction);
  db.close();
}
```

Use `getSavedEncryptedAudioUrl` directly in `playItem`. On missing, expired, or decryption failure, call `removeOfflineItem` for only that chapter and remove it from React state. Remove the preflight `hasValidEncryptedAudio` call.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx tsx --test src/lib/audio-cache.test.ts src/lib/player-settings-wiring.test.ts`

Expected: PASS; playback performs one selected-record read and no global scan.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/audio-cache.ts src/lib/audio-cache.test.ts src/components/offline-listen-panel.tsx src/lib/player-settings-wiring.test.ts
git commit -m "perf: read only selected offline audio"
```

### Task 3: Reconciliação Premium em lote e coordenada

**Files:**
- Create: `src/lib/offline-catalog-readiness.ts`
- Create: `src/lib/offline-catalog-readiness.test.ts`
- Modify: `src/lib/audio-cache.ts:465-500`
- Modify: `src/lib/offline-entitlement-sync.ts`
- Modify: `src/lib/offline-entitlement-sync.test.ts`
- Modify: `src/components/offline-entitlement-sync.tsx`
- Modify: `src/components/offline-listen-panel.tsx`

**Interfaces:**
- Produces: `updateOfflineItemsBatch(accountScope, items): Promise<number>`.
- Produces: `markOfflineCatalogReady(accountScope)` and `waitForOfflineCatalogReady(accountScope, timeoutMs)`.
- Changes: reconciliation dependency to `updateItemsBatch(accountScope, items)`.

- [ ] **Step 1: Write failing batch and readiness tests**

```ts
test("reconciliacao aplica uma unica atualizacao local em lote", async () => {
  const calls: string[] = [];
  await reconcileOfflineEntitlement("user-1", {
    ensureDeviceToken: async () => undefined,
    getRecoverableItems: async () => [itemA, itemB],
    renewItems: async () => [renewedA, renewedB],
    updateItemsBatch: async (_scope, items) => {
      calls.push(`batch:${items.length}`);
      return items.length;
    },
    preparePage: async () => calls.push("prepare"),
  });
  assert.deepEqual(calls, ["batch:2", "prepare"]);
});

test("espera do catalogo resolve quando a primeira leitura termina", async () => {
  const waiting = waitForOfflineCatalogReady("user-1", 100);
  markOfflineCatalogReady("user-1");
  await waiting;
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx tsx --test src/lib/offline-entitlement-sync.test.ts src/lib/offline-catalog-readiness.test.ts`

Expected: FAIL because reconciliation still extends and saves each item separately and readiness does not exist.

- [ ] **Step 3: Implement one-transaction renewal and route coordination**

Implement `updateOfflineItemsBatch` with one database connection and one `readwrite` transaction over both stores. Queue one `get` per renewed audio; from each success handler, queue the updated audio record and matching `ScopedOfflineItem`. Resolve with the number of audio records actually updated.

```ts
const renewedItems = mapRenewedItems(recoverableItems, serverRenewals);
const renewed = await dependencies.updateItemsBatch(accountScope, renewedItems);
if (renewed > 0) await dependencies.preparePage(accountScope);
return { renewed };
```

In the panel, call `markOfflineCatalogReady(accountScope)` in `finally`. In the sync component, use `usePathname()` and await readiness only when `pathname === "/offline"`, with a three-second safety timeout.

Store `nextAttemptAt` in `sessionStorage`: `now + 300_000` after success and `now + 60_000` after failure. Add a 15-second `AbortController` timeout to `/api/offline/renew` so a false-positive `navigator.onLine` cannot hold the sync indefinitely.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx tsx --test src/lib/offline-entitlement-sync.test.ts src/lib/offline-catalog-readiness.test.ts src/lib/audio-cache.test.ts`

Expected: PASS with exactly one local batch call and bounded waiting.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/offline-catalog-readiness.ts src/lib/offline-catalog-readiness.test.ts src/lib/audio-cache.ts src/lib/offline-entitlement-sync.ts src/lib/offline-entitlement-sync.test.ts src/components/offline-entitlement-sync.tsx src/components/offline-listen-panel.tsx
git commit -m "perf: batch offline premium reconciliation"
```

### Task 4: Shell offline imediato no service worker

**Files:**
- Modify: `public/sw.js:1-10,134-142,201-280`
- Modify: `src/lib/pwa-service-worker-runtime.test.ts`
- Modify: `src/lib/pwa-service-worker.test.ts`

**Interfaces:**
- Changes: `accountScopedOfflinePage(request, event)` uses cached response immediately.
- Preserves: account validation inside `publishOfflinePage`.
- Uses: four-second fallback only when cache is absent.

- [ ] **Step 1: Write failing runtime tests**

```ts
test("offline em cache responde sem esperar rede pendente", async () => {
  const network = deferred<Response>();
  const created = createRuntime(() => network.promise, caches);
  seedAccountScopeAndOfflinePage(caches, "account-a", "CACHED-A");
  const response = await created.runtime.accountScopedOfflinePage(request, event);
  assert.match(await response.text(), /CACHED-A/);
  assert.equal(network.settled, false);
});

test("sem cache usa fallback depois do limite de rede", async () => {
  const responsePromise = created.runtime.accountScopedOfflinePage(request, event, 10);
  const response = await responsePromise;
  assert.equal(await response.text(), "FALLBACK");
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx tsx --test src/lib/pwa-service-worker-runtime.test.ts src/lib/pwa-service-worker.test.ts`

Expected: FAIL because cached `/offline` still waits for `fetch` to settle and the function has no bounded no-cache path.

- [ ] **Step 3: Implement stale-while-revalidate and bump worker revision**

```js
async function accountScopedOfflinePage(request, event, timeoutMs = 4_000) {
  const scope = await getAccountScope();
  if (scope === ANONYMOUS_ACCOUNT_SCOPE) return networkOnlyWithOfflineFallback(request);
  const cache = await caches.open(getAccountPageCacheName(scope));
  const cached = await cache.match(request);
  const networkTask = fetch(request).then(async (response) => {
    if (response.ok) await publishOfflinePage(response.clone(), scope).catch(() => undefined);
    return response;
  });
  event?.waitUntil?.(networkTask.then(() => undefined).catch(() => undefined));
  if (cached) return cached;
  return raceNetworkWithOfflineFallback(networkTask, timeoutMs);
}
```

Pass the fetch event from the listener, retain account-scoped cache names, and bump service worker cache version/revision so installed clients activate the behavior.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx tsx --test src/lib/pwa-service-worker-runtime.test.ts src/lib/pwa-service-worker.test.ts src/lib/pwa-offline.test.ts`

Expected: PASS; cached response resolves before the deferred network and no-cache fallback is bounded.

- [ ] **Step 5: Commit**

```powershell
git add public/sw.js src/lib/pwa-service-worker-runtime.test.ts src/lib/pwa-service-worker.test.ts
git commit -m "perf: serve offline shell before network refresh"
```

### Task 5: Full verification and performance regression review

**Files:**
- Modify only files required by failures directly caused by Tasks 1–4.

**Interfaces:**
- Confirms the complete optimized flow and preserves existing behavior.

- [ ] **Step 1: Run focused offline suite**

Run: `npx tsx --test src/lib/offline-catalog.test.ts src/lib/offline-catalog-readiness.test.ts src/lib/offline-entitlement-sync.test.ts src/lib/audio-cache.test.ts src/lib/offline-items.test.ts src/lib/pwa-service-worker-runtime.test.ts src/lib/pwa-service-worker.test.ts src/lib/pwa-offline.test.ts`

Expected: all focused tests PASS with no unhandled rejection.

- [ ] **Step 2: Run complete suite**

Run: `npm test`

Expected: all tests PASS with zero failures.

- [ ] **Step 3: Run lint and production build**

Run: `npm run lint`

Expected: exit code 0 without ESLint errors.

Run: `npm run build`

Expected: exit code 0; TypeScript and all Next.js routes compile.

- [ ] **Step 4: Inspect operation budget and repository state**

Run: `git diff --check; git status --short`

Expected: no whitespace errors; only intentional files are changed, `.vscode/` is untouched, and tests prove the list path has constant metadata/key reads.
