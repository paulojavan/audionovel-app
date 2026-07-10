import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import test from "node:test";
import {
  buildFavoriteChapterNotification,
  notifyFavoriteUsersAboutPublishedChapter,
} from "./favorite-chapter-notifications";

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

test("uses different keys for another novel or Sao Paulo date", () => {
  const base = {
    novelId: "novel-1",
    novelSlug: "novel",
    novelTitle: "Novel",
    publishedAt: new Date("2026-07-10T12:00:00.000Z"),
  };

  const first = buildFavoriteChapterNotification(base);
  const anotherNovel = buildFavoriteChapterNotification({ ...base, novelId: "novel-2" });
  const anotherDate = buildFavoriteChapterNotification({ ...base, publishedAt: new Date("2026-07-11T03:00:00.000Z") });

  assert.notEqual(first.eventKey, anotherNovel.eventKey);
  assert.notEqual(first.eventKey, anotherDate.eventKey);
});

test("creates duplicate-safe notifications only for the volume novel favorites", async () => {
  let volumeQuery: unknown;
  let createManyArgs: unknown;
  const tx = {
    volume: {
      findUnique: async (args: unknown) => {
        volumeQuery = args;
        return {
          novel: {
            id: "novel-1",
            slug: "circle-of-inevitability",
            title: "Circle of Inevitability",
            favorites: [{ userId: "user-1" }, { userId: "user-2" }],
          },
        };
      },
    },
    notification: {
      createMany: async (args: unknown) => {
        createManyArgs = args;
        return { count: 2 };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const count = await notifyFavoriteUsersAboutPublishedChapter(tx, {
    volumeId: "volume-1",
    publishedAt: new Date("2026-07-10T12:00:00.000Z"),
  });

  assert.equal(count, 2);
  assert.deepEqual(volumeQuery, {
    where: { id: "volume-1" },
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
  assert.deepEqual(createManyArgs, {
    data: ["user-1", "user-2"].map((userId) => ({
      userId,
      novelId: "novel-1",
      type: "FAVORITE_NOVEL_NEW_CHAPTERS",
      eventKey: "novel-1:2026-07-10",
      title: "Novos capítulos adicionados",
      message: "Novos capítulos adicionados à novel Circle of Inevitability em 10/07/2026.",
      href: "/novels/circle-of-inevitability",
    })),
    skipDuplicates: true,
  });
});

test("does not write notifications when the novel has no favorites", async () => {
  let createManyCalled = false;
  const tx = {
    volume: {
      findUnique: async () => ({
        novel: { id: "novel-1", slug: "novel", title: "Novel", favorites: [] },
      }),
    },
    notification: {
      createMany: async () => {
        createManyCalled = true;
        return { count: 0 };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const count = await notifyFavoriteUsersAboutPublishedChapter(tx, {
    volumeId: "volume-1",
    publishedAt: new Date("2026-07-10T12:00:00.000Z"),
  });

  assert.equal(count, 0);
  assert.equal(createManyCalled, false);
});
