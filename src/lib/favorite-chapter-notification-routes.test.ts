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
