# Page Data Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce page latency by selecting only rendered Prisma fields and caching public catalog/content data for 60 seconds without caching user-specific data.

**Architecture:** Put critical Prisma selection objects and serializable catalog arguments in focused data modules, test those objects as the performance contract, and reuse the repository's existing `unstable_cache` and cache tags. Public editorial data is cached; comments and account-specific state remain fresh and are composed by the Server Components.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, Prisma 6, PostgreSQL/Aiven, Node test runner through `tsx --test`.

---

## File structure

- Create `src/lib/page-data-select.ts`: typed selections for public novel, comments, catalog cards, private pages, and high-volume admin pages.
- Create `src/lib/page-data-select.test.ts`: regression tests forbidding large/private fields and confirming required display fields.
- Create `src/lib/catalog-query.ts`: serializable catalog filter construction shared by the cache and page.
- Create `src/lib/catalog-query.test.ts`: filter normalization and pagination tests.
- Modify `src/lib/public-data.ts`: cached catalog and public novel functions.
- Modify public/private/admin page files listed below to consume cached functions or narrow selections.
- Modify admin mutation routes only where cache invalidation is incomplete.

### Task 1: Lock the performance contract with failing selection tests

**Files:**
- Create: `src/lib/page-data-select.test.ts`
- Create: `src/lib/page-data-select.ts`

- [ ] **Step 1: Write the failing tests**

Create tests that import the intended selections and verify forbidden and required fields:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_CONTENT_NOVEL_SELECT,
  LIBRARY_USER_SELECT,
  PUBLIC_NOVEL_SELECT,
} from "./page-data-select";

test("public novel chapter list excludes playback payloads", () => {
  const chapter = PUBLIC_NOVEL_SELECT.volumes.select.chapters.select;
  assert.equal("transcriptJson" in chapter, false);
  assert.equal("audioUrl" in chapter, false);
  assert.equal("youtubeUrl" in chapter, false);
  assert.equal(chapter.chapterPartsJson, true);
  assert.equal(chapter.title, true);
});

test("admin content list excludes chapter media and transcript fields", () => {
  const chapter = ADMIN_CONTENT_NOVEL_SELECT.volumes.select.chapters.select;
  assert.deepEqual(Object.keys(chapter).sort(), ["position", "positionEnd", "premiumOnly"]);
});

test("library user selection excludes password and large chapter fields", () => {
  assert.equal("passwordHash" in LIBRARY_USER_SELECT, false);
  const chapter = LIBRARY_USER_SELECT.listeningProgress.select.chapter.select;
  assert.equal("transcriptJson" in chapter, false);
  assert.equal(chapter.title, true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx tsx --test src/lib/page-data-select.test.ts
```

Expected: FAIL because `page-data-select.ts` or its exports do not exist.

- [ ] **Step 3: Implement typed selections**

Create `page-data-select.ts` with `as const satisfies Prisma.*Select`. Include exactly the fields used by:

```ts
export const PUBLIC_NOVEL_SELECT = {
  id: true,
  slug: true,
  title: true,
  author: true,
  synopsis: true,
  coverUrl: true,
  viewCount: true,
  ratingScore: true,
  ratingCount: true,
  volumes: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      position: true,
      chapters: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          position: true,
          positionEnd: true,
          contentType: true,
          durationSec: true,
          startSec: true,
          chapterPartsJson: true,
          viewCount: true,
          premiumOnly: true,
          createdAt: true,
        },
      },
    },
  },
  tags: {
    orderBy: { tag: { name: "asc" } },
    select: { tag: { select: { id: true, name: true, slug: true } } },
  },
  continuation: {
    select: { slug: true, title: true, coverUrl: true, synopsis: true },
  },
} as const satisfies Prisma.NovelSelect;
```

Add equally explicit selections for comments, catalog cards, library, profile, offline downloads, notifications, subscription plans, dashboard, finance, admin content, admin novel panel, moderation, reports, user details, and edit-page relations. A selection must not include a field not read by its page or child component.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
npx tsx --test src/lib/page-data-select.test.ts
```

Expected: PASS.

### Task 2: Add stable catalog arguments and public cache functions

**Files:**
- Create: `src/lib/catalog-query.ts`
- Create: `src/lib/catalog-query.test.ts`
- Modify: `src/lib/public-data.ts`
- Modify: `src/app/novels/page.tsx`
- Modify: `src/app/novels/[slug]/page.tsx`

- [ ] **Step 1: Write failing catalog argument tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCatalogQuery } from "./catalog-query";

test("normalizes empty filters and invalid pages", () => {
  assert.deepEqual(normalizeCatalogQuery({ q: " ", tag: "", author: "", page: "0" }), {
    query: "",
    selectedTag: "",
    selectedAuthor: "",
    currentPage: 1,
  });
});

test("preserves trimmed filters and positive page", () => {
  assert.deepEqual(normalizeCatalogQuery({ q: "  magia ", tag: "acao", author: "Ana", page: "3" }), {
    query: "magia",
    selectedTag: "acao",
    selectedAuthor: "Ana",
    currentPage: 3,
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx tsx --test src/lib/catalog-query.test.ts
```

Expected: FAIL because `normalizeCatalogQuery` does not exist.

- [ ] **Step 3: Implement normalization and cached queries**

Implement `normalizeCatalogQuery`, `buildCatalogWhere`, and these functions in `public-data.ts`:

```ts
export const getCachedCatalogPage = unstable_cache(
  async (query: string, selectedTag: string, selectedAuthor: string, currentPage: number, pageSize: number) => {
    const where = buildCatalogWhere({ query, selectedTag, selectedAuthor });
    const [total, novels] = await Promise.all([
      prisma.novel.count({ where }),
      prisma.novel.findMany({
        where,
        select: CATALOG_NOVEL_SELECT,
        orderBy: [{ ratingScore: "desc" }, { updatedAt: "desc" }],
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, novels };
  },
  ["catalog-page"],
  { revalidate: 60, tags: [CACHE_TAGS.content, CACHE_TAGS.tags] },
);

export const getCachedPublicNovel = unstable_cache(
  async (slug: string) => prisma.novel.findUnique({
    where: { slug },
    select: PUBLIC_NOVEL_SELECT,
  }),
  ["public-novel"],
  { revalidate: 60, tags: [CACHE_TAGS.content, CACHE_TAGS.tags] },
);
```

Update `/novels` to call normalization and `getCachedCatalogPage`. Update `/novels/[slug]` to fetch cached editorial data, then fetch comments and user-specific progress/rating/favorite in parallel with explicit selections. Preserve the current rendered props and ordering.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npx tsx --test src/lib/catalog-query.test.ts src/lib/page-data-select.test.ts
```

Expected: PASS.

### Task 3: Narrow private page queries

**Files:**
- Modify: `src/app/biblioteca/page.tsx`
- Modify: `src/app/perfil/page.tsx`
- Modify: `src/app/offline/page.tsx`
- Modify: `src/app/notificacoes/page.tsx`
- Modify: `src/app/assinaturas/page.tsx`
- Modify: `src/app/chapters/[id]/page.tsx`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Extend the selection regression test**

Add assertions that:

```ts
assert.equal("passwordHash" in PROFILE_USER_SELECT, false);
assert.equal("transcriptJson" in OFFLINE_DOWNLOAD_SELECT.chapter.select, false);
assert.deepEqual(
  Object.keys(CHAPTER_PROGRESS_SELECT).sort(),
  ["positionSec"],
);
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
npx tsx --test src/lib/page-data-select.test.ts
```

Expected: FAIL until the new exports exist.

- [ ] **Step 3: Apply selections to private pages**

Replace broad `include` calls with their selection objects. Keep all current `take`, `where`, and `orderBy` clauses inside the selection or query:

```ts
const user = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: LIBRARY_USER_SELECT,
});
```

For `canPlayChapter`, select only fields used by access checks and `ChapterPage`, including the required chapter playback/transcript fields and only `id`, `slug`, `title`, and `coverUrl` from the related novel. For progress, select only `positionSec`. For comments, use the exact comment-thread selection.

- [ ] **Step 4: Run focused and existing page logic tests**

Run:

```powershell
npm test -- --test-name-pattern="subscription|chapter|billing|page data"
```

Expected: PASS.

### Task 4: Narrow administrative queries

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/financeiro/page.tsx`
- Modify: `src/app/admin/moderacao/page.tsx`
- Modify: `src/app/admin/reportes/page.tsx`
- Modify: `src/app/admin/planos/page.tsx`
- Modify: `src/app/admin/conteudo/page.tsx`
- Modify: `src/app/admin/conteudo/[id]/page.tsx`
- Modify: `src/app/admin/conteudo/[id]/editar/page.tsx`
- Modify: `src/app/admin/conteudo/capitulos/[id]/editar/page.tsx`
- Modify: `src/app/admin/usuarios/[id]/page.tsx`

- [ ] **Step 1: Extend failing admin selection tests**

Assert:

```ts
const adminChapter = ADMIN_NOVEL_PANEL_SELECT.volumes.select.chapters.select;
assert.equal("transcriptJson" in adminChapter, false);
assert.equal(adminChapter.createdAt, true);
assert.deepEqual(ADMIN_PAYMENT_SELECT.user.select, { email: true });
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
npx tsx --test src/lib/page-data-select.test.ts
```

Expected: FAIL until all admin exports are defined.

- [ ] **Step 3: Replace broad admin includes**

Use explicit selections while preserving the existing calculations and components. Examples:

```ts
prisma.novel.findMany({
  where,
  orderBy: { updatedAt: "desc" },
  select: ADMIN_CONTENT_NOVEL_SELECT,
});

prisma.paymentTransaction.findMany({
  where: { createdAt },
  take: 100,
  orderBy: { createdAt: "desc" },
  select: ADMIN_PAYMENT_SELECT,
});
```

Keep the chapter editor's full chapter scalar fields because the edit form consumes them, but restrict `volume.novel` to `id`, `title`, and its volumes' `id`, `title`, and `position`.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npx tsx --test src/lib/page-data-select.test.ts
```

Expected: PASS.

### Task 5: Complete invalidation, verify, and benchmark

**Files:**
- Modify only if needed: `src/app/api/admin/tags/route.ts`
- Modify only if needed: admin novel, volume, and chapter mutation routes

- [ ] **Step 1: Audit mutation invalidation**

Every successful novel/volume/chapter mutation must call:

```ts
revalidateTag(CACHE_TAGS.content, "max");
```

Every successful tag mutation must call both:

```ts
revalidateTag(CACHE_TAGS.tags, "max");
revalidateTag(CACHE_TAGS.content, "max");
```

- [ ] **Step 2: Run the complete automated verification**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Re-run read-only data-volume measurements**

Using the production Prisma client and the largest novel, measure `Buffer.byteLength(JSON.stringify(result))` for `PUBLIC_NOVEL_SELECT` and `ADMIN_CONTENT_NOVEL_SELECT`.

Expected:

- public novel remains below 500 KB and excludes `transcriptJson`;
- admin content remains below 150 KB and excludes media/transcript fields.

- [ ] **Step 4: Inspect the final diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; `.superpowers/` remains untouched and untracked.
