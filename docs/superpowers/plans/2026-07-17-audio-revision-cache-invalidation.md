# Audio Revision Cache Invalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Versionar a mídia de cada capítulo e substituir caches online e offline quando o administrador corrigir o áudio.

**Architecture:** `Chapter.audioRevision` será a fonte de verdade e mudará apenas quando a identidade da mídia mudar ou o administrador sinalizar substituição na mesma URL. Contratos de preparação e renovação transportarão a revisão até `OfflineItem` e `AudioRecord`; reutilização exigirá igualdade de revisão e a reconciliação baixará a nova cópia antes de atualizar metadados locais.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5, Prisma 6.19.3/PostgreSQL, IndexedDB, Web Crypto AES-GCM, Node test runner via `tsx --test`.

## Global Constraints

- `audioRevision` começa em `1` e só aumenta quando tipo, URL ou substituição explícita da mídia mudam.
- Dispositivo totalmente offline continua tocando a cópia anterior.
- Cópia antiga não é apagada antes do download, criptografia e gravação da revisão nova.
- Registro legado sem revisão é substituído na primeira sincronização conectada bem-sucedida.
- A listagem offline continua sem materializar blobs de áudio.
- Não alterar AES-GCM, fragmentar áudio, adicionar histórico ou permitir rollback.

---

### Task 1: Fonte de verdade da revisão de mídia

**Files:**
- Create: `src/lib/audio-revision.ts`
- Create: `src/lib/audio-revision.test.ts`
- Create: `prisma/aiven-2026-07-17-audio-revisions.sql`
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/admin-chapter-validation.ts`
- Modify: `src/app/api/admin/chapters/[id]/route.ts`
- Modify: `src/components/admin-content-forms.tsx`

**Interfaces:**
- Produces: `shouldIncrementAudioRevision(previous, next, forceRefresh): boolean` e `getChapterAudioPath(chapterId, audioRevision, offlineKey?): string`.
- Consumes: `chapterSchema.refreshAudioRevision: boolean`, estado persistido anterior e formulário administrativo.

- [ ] **Step 1: Write failing revision domain tests**

```ts
test("increments for URL, type, or explicit same-URL replacement", () => {
  const current = { contentType: "AUDIO", audioUrl: "https://cdn/a.mp3" };
  assert.equal(shouldIncrementAudioRevision(current, { ...current, audioUrl: "https://cdn/b.mp3" }, false), true);
  assert.equal(shouldIncrementAudioRevision(current, { contentType: "YOUTUBE", audioUrl: null }, false), true);
  assert.equal(shouldIncrementAudioRevision(current, current, true), true);
  assert.equal(shouldIncrementAudioRevision(current, current, false), false);
});

test("builds a versioned authorized audio path", () => {
  assert.equal(getChapterAudioPath("chapter 1", 3), "/api/chapters/chapter%201/audio?revision=3");
  assert.equal(getChapterAudioPath("chapter 1", 3, "key/value"), "/api/chapters/chapter%201/audio?revision=3&offline=key%2Fvalue");
});
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `npx tsx --test src/lib/audio-revision.test.ts`

Expected: FAIL because `src/lib/audio-revision.ts` does not exist.

- [ ] **Step 3: Implement the pure revision helpers**

```ts
export function shouldIncrementAudioRevision(previous: ChapterMediaIdentity, next: ChapterMediaIdentity, forceRefresh: boolean) {
  return forceRefresh || previous.contentType !== next.contentType || normalizeAudioUrl(previous.audioUrl) !== normalizeAudioUrl(next.audioUrl);
}

export function getChapterAudioPath(chapterId: string, audioRevision: number, offlineKey?: string) {
  const params = new URLSearchParams({ revision: String(audioRevision) });
  if (offlineKey) params.set("offline", offlineKey);
  return `/api/chapters/${encodeURIComponent(chapterId)}/audio?${params}`;
}
```

- [ ] **Step 4: Add failing persistence and form wiring assertions**

Extend `src/lib/audio-revision.test.ts` to assert that the Prisma schema and Aiven SQL define `audioRevision` default `1`, the PATCH route calls the helper and uses `{ increment: 1 }`, the schema accepts `refreshAudioRevision`, and the edit form renders and sends the same boolean.

- [ ] **Step 5: Run the wiring test and verify RED**

Run: `npx tsx --test src/lib/audio-revision.test.ts`

Expected: FAIL on missing schema, SQL, route, validator and form wiring.

- [ ] **Step 6: Implement persistence and admin editing**

Add `audioRevision Int @default(1)` to `Chapter` and SQL:

```sql
ALTER TABLE "Chapter"
ADD COLUMN IF NOT EXISTS "audioRevision" INTEGER NOT NULL DEFAULT 1;
```

Add `refreshAudioRevision: z.boolean().optional().default(false)` to `chapterSchema`. In the PATCH transaction, load the current `{ contentType, audioUrl }`, call `shouldIncrementAudioRevision`, and add `audioRevision: { increment: 1 }` only when true. Add the checkbox `O arquivo de audio foi substituido na mesma URL` and send `refreshAudioRevision: data.get("refreshAudioRevision") === "on"`.

- [ ] **Step 7: Regenerate Prisma and verify GREEN**

Run: `npm run prisma:generate`

Run: `npx tsx --test src/lib/audio-revision.test.ts src/lib/admin-chapter-validation.test.ts`

Expected: both commands exit 0 and tests pass.

- [ ] **Step 8: Commit the revision source of truth**

```powershell
git add -- 'src/lib/audio-revision.ts' 'src/lib/audio-revision.test.ts' 'prisma/schema.prisma' 'prisma/aiven-2026-07-17-audio-revisions.sql' 'src/lib/admin-chapter-validation.ts' 'src/app/api/admin/chapters/[id]/route.ts' 'src/components/admin-content-forms.tsx'
git commit -m "feat: version chapter audio revisions"
```

### Task 2: Transportar revisão pelos contratos conectados

**Files:**
- Modify: `src/lib/page-data-select.ts`
- Modify: `src/lib/page-data-select.test.ts`
- Modify: `src/app/chapters/[id]/page.tsx`
- Modify: `src/components/novel-volume-list.tsx`
- Modify: `src/app/api/offline/prepare/route.ts`
- Modify: `src/app/api/offline/renew/route.ts`
- Modify: `src/app/offline/page.tsx`
- Modify: `src/lib/offline-items.ts`
- Create: `src/lib/audio-revision-wiring.test.ts`

**Interfaces:**
- Produces: `audioRevision` nos selects de página/lista/offline, em `OfflineItem`, no player, no botão offline e nas respostas `prepare`/`renew`.
- Consumes: `getChapterAudioPath` da Task 1.

- [ ] **Step 1: Write failing contract assertions**

```ts
assert.equal(CHAPTER_PAGE_SELECT.audioRevision, true);
assert.equal(PUBLIC_NOVEL_SELECT.volumes.select.chapters.select.audioRevision, true);
assert.equal(OFFLINE_DOWNLOAD_SELECT.chapter.select.audioRevision, true);
```

Add source assertions that the chapter page passes `audioRevision`, offline prepare/renew return it and use `getChapterAudioPath`, the novel list includes it in metadata, and the offline page maps it.

- [ ] **Step 2: Run the wiring tests and verify RED**

Run: `npx tsx --test src/lib/audio-revision-wiring.test.ts src/lib/page-data-select.test.ts`

Expected: FAIL because no select or payload exposes `audioRevision`.

- [ ] **Step 3: Wire the server and component contracts**

Add `audioRevision?: number` to `OfflineItem` for compatibility with legacy metadata. Add `audioRevision: true` to the three selects. Use:

```ts
audioUrl: getChapterAudioPath(chapterId, access.chapter.audioRevision, cacheKey)
```

in prepare, and return `{ chapterId, cacheKey, expiresAt, audioRevision, audioUrl }` from renew. Pass the selected revision to `AudioPlayer`, `OfflineChapterButton` metadata, and server-rendered offline items.

- [ ] **Step 4: Run contract tests and verify GREEN**

Run: `npx tsx --test src/lib/audio-revision-wiring.test.ts src/lib/page-data-select.test.ts src/lib/offline-items.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit connected contracts**

```powershell
git add -- 'src/lib/page-data-select.ts' 'src/lib/page-data-select.test.ts' 'src/app/chapters/[id]/page.tsx' 'src/components/novel-volume-list.tsx' 'src/app/api/offline/prepare/route.ts' 'src/app/api/offline/renew/route.ts' 'src/app/offline/page.tsx' 'src/lib/offline-items.ts' 'src/lib/audio-revision-wiring.test.ts'
git commit -m "feat: expose audio revisions to playback"
```

### Task 3: Reutilização do IndexedDB condicionada à revisão

**Files:**
- Modify: `src/lib/audio-cache.ts`
- Modify: `src/lib/audio-cache.test.ts`
- Modify: `src/components/audio-player.tsx`
- Modify: `src/components/offline-chapter-button.tsx`

**Interfaces:**
- Produces: `isAudioRevisionReusable(cached, expected): boolean`; opções `audioRevision` em `getEncryptedAudioUrl` e `hasValidEncryptedAudio`.
- Consumes: revisão esperada fornecida pelo player e botão offline.

- [ ] **Step 1: Write failing cache revision tests**

```ts
test("reuses only the requested audio revision", () => {
  assert.equal(isAudioRevisionReusable(3, 3), true);
  assert.equal(isAudioRevisionReusable(2, 3), false);
  assert.equal(isAudioRevisionReusable(undefined, 3), false);
  assert.equal(isAudioRevisionReusable(3, undefined), true);
});
```

Add source assertions proving `AudioRecord` and `AudioCacheOptions` carry `audioRevision`, mismatch returns a miss without `deleteRecord`, and the final `writeRecord` stores the requested revision.

- [ ] **Step 2: Run the cache test and verify RED**

Run: `npx tsx --test src/lib/audio-cache.test.ts`

Expected: FAIL because `isAudioRevisionReusable` is missing.

- [ ] **Step 3: Implement revision-aware cache reads and writes**

```ts
export function isAudioRevisionReusable(cached: number | undefined, expected: number | undefined) {
  return expected === undefined || cached === expected;
}
```

Add `audioRevision?: number` to records/options. Make `getValidCachedRecord` return `null` on revision mismatch without deleting the record. Persist the requested revision only after download and encryption complete. Preserve it when copying temporary cache into offline mode.

- [ ] **Step 4: Wire player and offline button**

Add required `audioRevision: number` to `AudioPlayer`, pass it to `getEncryptedAudioUrl`, and add it to the callback dependencies. Read `metadata.audioRevision` in `OfflineChapterButton`, pass it to `hasValidEncryptedAudio` and `getEncryptedAudioUrl`, and save the revision with the offline item.

- [ ] **Step 5: Run directed cache tests and verify GREEN**

Run: `npx tsx --test src/lib/audio-cache.test.ts src/lib/audio-revision-wiring.test.ts src/lib/offline-chapter-button-wiring.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 6: Commit revision-aware cache behavior**

```powershell
git add -- 'src/lib/audio-cache.ts' 'src/lib/audio-cache.test.ts' 'src/components/audio-player.tsx' 'src/components/offline-chapter-button.tsx'
git commit -m "fix: reject stale chapter audio caches"
```

### Task 4: Substituição automática durante sincronização offline

**Files:**
- Modify: `src/lib/offline-entitlement-sync.ts`
- Modify: `src/lib/offline-entitlement-sync.test.ts`
- Modify: `src/components/offline-entitlement-sync.tsx`

**Interfaces:**
- Produces: `RenewedOfflineItem` com `audioRevision` e `audioUrl`; resultado `{ renewed, failed, nextCursor? }`.
- Consumes: dependência `refreshAudio(accountScope, renewedItem)` que baixa e grava uma revisão desatualizada antes do batch de metadados.

- [ ] **Step 1: Write failing reconciliation tests**

```ts
test("refreshes a stale audio before publishing renewed metadata", async () => {
  const calls: string[] = [];
  await reconcileOfflineEntitlement("user-1", {
    ensureDeviceToken: async () => undefined,
    getRecoverableItems: async () => [legacyItemWithRevision1],
    renewItems: async () => [renewedItemWithRevision2],
    refreshAudio: async () => { calls.push("audio"); },
    updateItemsBatch: async (_scope, items) => { calls.push(`batch:${items[0].audioRevision}`); return 1; },
    preparePage: async () => { calls.push("prepare"); },
  });
  assert.deepEqual(calls, ["audio", "batch:2", "prepare"]);
});
```

Add tests that an equal revision skips `refreshAudio`, a failed refresh preserves/skips that item and increments `failed`, and a legacy item without revision is refreshed.

- [ ] **Step 2: Run reconciliation tests and verify RED**

Run: `npx tsx --test src/lib/offline-entitlement-sync.test.ts`

Expected: FAIL because the renewal contract and `refreshAudio` dependency do not exist.

- [ ] **Step 3: Implement ordered stale replacement**

For every renewed item, compare local and server revisions. Await `refreshAudio` before adding a stale item to `itemsToUpdate`; catch a per-item failure, increment `failed`, and leave its local metadata unchanged. Equal revisions go directly to the batch. Return `{ renewed, failed, nextCursor? }` and prepare the page when at least one item was updated.

- [ ] **Step 4: Wire the browser replacement dependency**

Import `getEncryptedAudioUrl` and `enqueueOfflineDownload` in `OfflineEntitlementSync` and provide:

```ts
refreshAudio: (scope, item) => enqueueOfflineDownload(() =>
  getEncryptedAudioUrl(item.chapterId, item.audioUrl, {
    accountScope: scope,
    mode: "offline",
    expiresAt: item.expiresAt,
    audioRevision: item.audioRevision,
  }),
),
```

After reconciliation, treat `failed > 0` as a failed sync interval while preserving successful replacements already committed.

- [ ] **Step 5: Run sync tests and verify GREEN**

Run: `npx tsx --test src/lib/offline-entitlement-sync.test.ts src/lib/audio-cache.test.ts src/lib/offline-sync-policy.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 6: Commit automatic offline replacement**

```powershell
git add -- 'src/lib/offline-entitlement-sync.ts' 'src/lib/offline-entitlement-sync.test.ts' 'src/components/offline-entitlement-sync.tsx'
git commit -m "fix: refresh stale offline chapter audio"
```

### Task 5: Verify audio behavior and repository health

**Files:**
- Verify only.

**Interfaces:**
- Consumes: all outputs from Tasks 1-4.
- Produces: fresh evidence for regression, lint, types and production compilation.

- [ ] **Step 1: Run all audio and offline directed tests**

Run: `npx tsx --test src/lib/audio-*.test.ts src/lib/offline-*.test.ts src/lib/page-data-select.test.ts src/lib/admin-chapter-validation.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run the complete suite**

Run: `npm test`

Expected: exit code 0 and zero failed tests.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 5: Inspect schema and diff**

Run: `npx prisma validate`

Run: `git diff --check`

Expected: both commands exit 0 with no errors.
