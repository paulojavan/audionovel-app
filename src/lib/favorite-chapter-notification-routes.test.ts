import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const createRoute = readFileSync("src/app/api/admin/chapters/route.ts", "utf8");
const editRoute = readFileSync("src/app/api/admin/chapters/[id]/route.ts", "utf8");

test("POST creates published chapters and favorite notifications atomically", () => {
  assert.match(createRoute, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(createRoute, /publishedAt: chapter\.published \? publicationDate : null/);
  assert.match(createRoute, /tx\.chapter\.create/);
  assert.match(createRoute, /if \(chapter\.published\)[\s\S]*notifyFavoriteUsersAboutPublishedChapter/);
});

test("POST invalidates notification cache only for a publication event", () => {
  assert.match(createRoute, /notificationEvent[\s\S]*revalidateTag\(CACHE_TAGS\.notifications, "max"\)/);
});

test("chapter publication transactions tolerate the observed database latency", () => {
  for (const route of [createRoute, editRoute]) {
    assert.match(route, /\{ maxWait: 5_000, timeout: 15_000 \}/);
  }
});

test("chapter publication reports transient database failures as unavailable", () => {
  for (const route of [createRoute, editRoute]) {
    assert.match(route, /isTransientPrismaSessionError\(error\)/);
    assert.match(route, /getPrismaErrorCode\(error\) === "P2028"/);
    assert.match(route, /status: 503/);
  }
});

test("PATCH claims first publication with a conditional update", () => {
  assert.match(editRoute, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(editRoute, /tx\.chapter\.updateMany/);
  assert.match(editRoute, /where: \{ id, publishedAt: null \}/);
  assert.match(editRoute, /data: \{ publishedAt: publicationDate \}/);
  assert.match(editRoute, /publicationClaim\.count === 1/);
});

test("PATCH notifies only the transaction that claims first publication", () => {
  assert.match(editRoute, /if \(notificationEvent\)[\s\S]*notifyFavoriteUsersAboutPublishedChapter/);
  assert.match(editRoute, /if \(notificationEvent\) revalidateTag\(CACHE_TAGS\.notifications, "max"\)/);
});
