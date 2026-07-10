# Favorite Novel Chapter Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify current followers once per novel and São Paulo calendar date when one or more chapters are published.

**Architecture:** Persist first-publication state on `Chapter`, persist a deterministic per-novel/day key on `Notification`, and create notifications inside the same Prisma transaction as the chapter mutation. A focused library owns São Paulo date formatting, message construction, favorite lookup, and duplicate-safe bulk insertion.

**Tech Stack:** Next.js 16.2.9 App Router Route Handlers, TypeScript, Prisma 6.19.3, PostgreSQL/Aiven, Node test runner via `tsx --test`.

## Global Constraints

- Notify only on chapter creation with `published: true` or the first transition from draft to published.
- Never notify retroactively when a user favorites a novel.
- Emit at most one notification per user, novel, and `America/Sao_Paulo` date.
- Use title `Novos capítulos adicionados`.
- Use message `Novos capítulos adicionados à novel {título da novel} em {DD/MM/AAAA}.`.
- Link to `/novels/{slug}` and do not include chapter number or title.
- Keep chapter persistence and notification creation atomic.
- Preserve existing comment notifications.

---

### Task 1: Persist publication and notification deduplication state

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/aiven-2026-07-10-favorite-chapter-notifications.sql`
- Create: `src/lib/favorite-chapter-notification-schema.test.ts`

**Interfaces:**
- Produces: `Chapter.publishedAt: Date | null`, `Notification.novelId: string | null`, `Notification.eventKey: string | null`, and unique `(userId, type, eventKey)` persistence.
- Consumes: existing `Novel`, `Chapter`, `Notification`, and `User` relations.

- [ ] **Step 1: Write the failing schema and migration test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/aiven-2026-07-10-favorite-chapter-notifications.sql",
  "utf8",
);

test("schema persists first publication and generic novel notification keys", () => {
  assert.match(schema, /publishedAt\s+DateTime\?/);
  assert.match(schema, /novelId\s+String\?/);
  assert.match(schema, /eventKey\s+String\?/);
  assert.match(schema, /@@unique\(\[userId, type, eventKey\]\)/);
  assert.match(schema, /novel\s+Novel\?\s+@relation\(fields: \[novelId\], references: \[id\], onDelete: Cascade\)/);
});

test("Aiven migration backfills published chapters and adds deduplication", () => {
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /ADD COLUMN "publishedAt" TIMESTAMP\(3\)/);
  assert.match(migration, /SET "publishedAt" = "createdAt"/);
  assert.match(migration, /WHERE "published" = TRUE/);
  assert.match(migration, /ADD COLUMN "novelId" TEXT/);
  assert.match(migration, /ADD COLUMN "eventKey" TEXT/);
  assert.match(migration, /FOREIGN KEY \("novelId"\) REFERENCES "Novel"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.match(migration, /CREATE UNIQUE INDEX "Notification_userId_type_eventKey_key"/);
  assert.match(migration, /^COMMIT;/m);
});
```

- [ ] **Step 2: Run the test and verify the missing migration failure**

Run: `npx tsx --test src/lib/favorite-chapter-notification-schema.test.ts`

Expected: FAIL because `prisma/aiven-2026-07-10-favorite-chapter-notifications.sql` and the new fields do not exist.

- [ ] **Step 3: Add the Prisma fields and relations**

Add `notifications Notification[]` to `Novel`, `publishedAt DateTime?` to `Chapter`, and the following fields to `Notification`:

```prisma
  novelId   String?
  eventKey  String?
  novel     Novel?   @relation(fields: [novelId], references: [id], onDelete: Cascade)

  @@unique([userId, type, eventKey])
  @@index([novelId, createdAt])
```

- [ ] **Step 4: Add the Aiven migration**

```sql
BEGIN;

ALTER TABLE "Chapter"
  ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "Chapter"
SET "publishedAt" = "createdAt"
WHERE "published" = TRUE AND "publishedAt" IS NULL;

ALTER TABLE "Notification"
  ADD COLUMN "novelId" TEXT,
  ADD COLUMN "eventKey" TEXT;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_novelId_fkey"
  FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Notification_novelId_createdAt_idx"
  ON "Notification"("novelId", "createdAt");

CREATE UNIQUE INDEX "Notification_userId_type_eventKey_key"
  ON "Notification"("userId", "type", "eventKey");

COMMIT;
```

- [ ] **Step 5: Generate the Prisma client and run the focused test**

Run: `npx prisma generate && npx tsx --test src/lib/favorite-chapter-notification-schema.test.ts`

Expected: Prisma generation succeeds and 2 tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add prisma/schema.prisma prisma/aiven-2026-07-10-favorite-chapter-notifications.sql src/lib/favorite-chapter-notification-schema.test.ts
git commit -m "feat: persist favorite chapter notification state"
```

### Task 2: Build generic favorite-chapter notifications

**Files:**
- Create: `src/lib/favorite-chapter-notifications.ts`
- Create: `src/lib/favorite-chapter-notifications.test.ts`

**Interfaces:**
- Produces: `buildFavoriteChapterNotification(input)` and `notifyFavoriteUsersAboutPublishedChapter(tx, input): Promise<number>`.
- Consumes: `Prisma.TransactionClient`, `volumeId: string`, and `publishedAt: Date`.

- [ ] **Step 1: Write failing formatter tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildFavoriteChapterNotification } from "./favorite-chapter-notifications";

test("builds the generic notification in the Sao Paulo calendar date", () => {
  assert.deepEqual(
    buildFavoriteChapterNotification({
      novelId: "novel-1",
      novelSlug: "circle-of-inevitability",
      novelTitle: "Circle of Inevitability",
      publishedAt: new Date("2026-07-10T03:00:00.000Z"),
    }),
    {
      type: "FAVORITE_NOVEL_NEW_CHAPTERS",
      eventKey: "novel-1:2026-07-10",
      title: "Novos capítulos adicionados",
      message: "Novos capítulos adicionados à novel Circle of Inevitability em 10/07/2026.",
      href: "/novels/circle-of-inevitability",
    },
  );
});

test("uses the previous Sao Paulo date before midnight locally", () => {
  const notification = buildFavoriteChapterNotification({
    novelId: "novel-1",
    novelSlug: "circle-of-inevitability",
    novelTitle: "Circle of Inevitability",
    publishedAt: new Date("2026-07-10T02:59:59.000Z"),
  });

  assert.equal(notification.eventKey, "novel-1:2026-07-09");
  assert.match(notification.message, /09\/07\/2026\.$/);
});

test("keeps the same key for the same novel and local date", () => {
  const first = buildFavoriteChapterNotification({
    novelId: "novel-1",
    novelSlug: "novel",
    novelTitle: "Novel",
    publishedAt: new Date("2026-07-10T12:00:00.000Z"),
  });
  const second = buildFavoriteChapterNotification({
    novelId: "novel-1",
    novelSlug: "novel",
    novelTitle: "Novel",
    publishedAt: new Date("2026-07-11T02:59:59.000Z"),
  });

  assert.equal(first.eventKey, second.eventKey);
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `npx tsx --test src/lib/favorite-chapter-notifications.test.ts`

Expected: FAIL with module-not-found for `favorite-chapter-notifications`.

- [ ] **Step 3: Implement formatting and duplicate-safe insertion**

```ts
import type { Prisma } from "@prisma/client";

export const FAVORITE_NOVEL_NEW_CHAPTERS = "FAVORITE_NOVEL_NEW_CHAPTERS";

type NotificationInput = {
  novelId: string;
  novelSlug: string;
  novelTitle: string;
  publishedAt: Date;
};

export function buildFavoriteChapterNotification(input: NotificationInput) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(input.publishedAt);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = value("year");
  const month = value("month");
  const day = value("day");

  return {
    type: FAVORITE_NOVEL_NEW_CHAPTERS,
    eventKey: `${input.novelId}:${year}-${month}-${day}`,
    title: "Novos capítulos adicionados",
    message: `Novos capítulos adicionados à novel ${input.novelTitle} em ${day}/${month}/${year}.`,
    href: `/novels/${input.novelSlug}`,
  };
}

export async function notifyFavoriteUsersAboutPublishedChapter(
  tx: Prisma.TransactionClient,
  input: { volumeId: string; publishedAt: Date },
) {
  const volume = await tx.volume.findUnique({
    where: { id: input.volumeId },
    select: {
      novel: {
        select: {
          id: true,
          slug: true,
          title: true,
          favorites: { select: { userId: true } },
        },
      },
    },
  });
  if (!volume) throw new Error("volume");
  if (!volume.novel.favorites.length) return 0;

  const notification = buildFavoriteChapterNotification({
    novelId: volume.novel.id,
    novelSlug: volume.novel.slug,
    novelTitle: volume.novel.title,
    publishedAt: input.publishedAt,
  });
  const result = await tx.notification.createMany({
    data: volume.novel.favorites.map(({ userId }) => ({
      userId,
      novelId: volume.novel.id,
      ...notification,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
```

- [ ] **Step 4: Run the formatter tests**

Run: `npx tsx --test src/lib/favorite-chapter-notifications.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/favorite-chapter-notifications.ts src/lib/favorite-chapter-notifications.test.ts
git commit -m "feat: build generic favorite chapter notifications"
```

### Task 3: Notify favorites when a chapter is created published

**Files:**
- Modify: `src/app/api/admin/chapters/route.ts`
- Create: `src/lib/favorite-chapter-notification-routes.test.ts`

**Interfaces:**
- Consumes: `notifyFavoriteUsersAboutPublishedChapter(tx, { volumeId, publishedAt })` from Task 2.
- Produces: atomic POST creation and notification invalidation.

- [ ] **Step 1: Write the failing POST wiring test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const createRoute = readFileSync("src/app/api/admin/chapters/route.ts", "utf8");

test("POST creates published chapters and favorite notifications atomically", () => {
  assert.match(createRoute, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(createRoute, /publishedAt: chapter\.published \? publicationDate : null/);
  assert.match(createRoute, /tx\.chapter\.create/);
  assert.match(createRoute, /if \(chapter\.published\)[\s\S]*notifyFavoriteUsersAboutPublishedChapter/);
});

test("POST invalidates notification cache only for a publication event", () => {
  assert.match(createRoute, /notificationEvent[\s\S]*revalidateTag\(CACHE_TAGS\.notifications, "max"\)/);
});
```

- [ ] **Step 2: Run the route test and verify it fails on the current array transaction**

Run: `npx tsx --test src/lib/favorite-chapter-notification-routes.test.ts`

Expected: FAIL because POST still uses `prisma.$transaction(chapters.map(...))` and does not persist `publishedAt` or create notifications.

- [ ] **Step 3: Convert POST to an interactive transaction**

Import `notifyFavoriteUsersAboutPublishedChapter`. Use one `publicationDate = new Date()` for persistence, key generation, and display. Inside `prisma.$transaction(async (tx) => ...)`, create each chapter with:

```ts
publishedAt: chapter.published ? publicationDate : null,
```

After each published create, call:

```ts
await notifyFavoriteUsersAboutPublishedChapter(tx, {
  volumeId: chapter.volumeId,
  publishedAt: publicationDate,
});
notificationEvent = true;
```

Return `{ created, notificationEvent }` from the transaction and preserve the existing single-versus-batch JSON response shape.

- [ ] **Step 4: Invalidate both relevant tags after success**

```ts
revalidateTag(CACHE_TAGS.content, "max");
if (notificationEvent) revalidateTag(CACHE_TAGS.notifications, "max");
```

- [ ] **Step 5: Run focused creation tests**

Run: `npx tsx --test src/lib/favorite-chapter-notification-routes.test.ts src/lib/admin-chapter-create-persistence.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/admin/chapters/route.ts src/lib/favorite-chapter-notification-routes.test.ts
git commit -m "feat: notify favorites on published chapter creation"
```

### Task 4: Notify once on the first draft publication

**Files:**
- Modify: `src/app/api/admin/chapters/[id]/route.ts`
- Modify: `src/lib/favorite-chapter-notification-routes.test.ts`

**Interfaces:**
- Consumes: `Chapter.publishedAt` and `notifyFavoriteUsersAboutPublishedChapter`.
- Produces: concurrency-safe first-publication claim for PATCH.

- [ ] **Step 1: Add the failing PATCH tests**

```ts
const editRoute = readFileSync("src/app/api/admin/chapters/[id]/route.ts", "utf8");

test("PATCH claims first publication with a conditional update", () => {
  assert.match(editRoute, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(editRoute, /publishedAt: null/);
  assert.match(editRoute, /tx\.chapter\.updateMany/);
  assert.match(editRoute, /data: \{ publishedAt: publicationDate \}/);
  assert.match(editRoute, /publicationClaim\.count === 1/);
});

test("PATCH notifies only the transaction that claims first publication", () => {
  assert.match(editRoute, /if \(notificationEvent\)[\s\S]*notifyFavoriteUsersAboutPublishedChapter/);
  assert.match(editRoute, /revalidateTag\(CACHE_TAGS\.notifications, "max"\)/);
});
```

- [ ] **Step 2: Run the route test and verify the PATCH assertions fail**

Run: `npx tsx --test src/lib/favorite-chapter-notification-routes.test.ts`

Expected: POST tests PASS and PATCH tests FAIL because PATCH is not transactional and does not claim first publication.

- [ ] **Step 3: Add the atomic first-publication claim**

Inside an interactive transaction, run this only when `parsed.data.published` is true:

```ts
const publicationClaim = await tx.chapter.updateMany({
  where: { id, publishedAt: null },
  data: { publishedAt: publicationDate },
});
const notificationEvent = publicationClaim.count === 1;
```

Perform the existing chapter update through `tx.chapter.update` without assigning `publishedAt`, so prior publication state is never cleared. If `notificationEvent`, call the notification helper with `parsed.data.volumeId` and `publicationDate` before returning from the transaction.

- [ ] **Step 4: Invalidate notification cache after a claimed publication**

Return `{ chapter, notificationEvent }` from the transaction, preserve the existing response body, and add:

```ts
if (notificationEvent) revalidateTag(CACHE_TAGS.notifications, "max");
```

- [ ] **Step 5: Run all feature tests**

Run: `npx tsx --test src/lib/favorite-chapter-notification-schema.test.ts src/lib/favorite-chapter-notifications.test.ts src/lib/favorite-chapter-notification-routes.test.ts src/lib/admin-chapter-create-persistence.test.ts`

Expected: all feature and chapter persistence tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/admin/chapters/[id]/route.ts src/lib/favorite-chapter-notification-routes.test.ts
git commit -m "feat: notify favorites on first chapter publication"
```

### Task 5: Verify the completed feature

**Files:**
- Verify only; modify feature files only if a check exposes a defect.

**Interfaces:**
- Consumes: all outputs from Tasks 1–4.
- Produces: verified implementation evidence.

- [ ] **Step 1: Validate Prisma schema**

Run: `npx prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 2: Run the entire test suite**

Run: `npm test`

Expected: all tests PASS with exit code 0.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: exit code 0. Any database reachability warning is informational only if the build exits successfully.

- [ ] **Step 5: Check the final diff and worktree state**

Run: `git diff --check && git status --short && git log --oneline -5`

Expected: no whitespace errors; only the user's pre-existing `.vscode/` remains untracked in the original checkout; feature commits are present in the isolated implementation branch.
