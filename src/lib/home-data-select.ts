import type { Prisma } from "@prisma/client";

export const HOME_NOVEL_SELECT = {
  id: true,
  slug: true,
  title: true,
  author: true,
  coverUrl: true,
  status: true,
  ratingScore: true,
  ratingCount: true,
} as const satisfies Prisma.NovelSelect;

export const HOME_RANKING_NOVEL_SELECT = {
  id: true,
  slug: true,
  title: true,
  coverUrl: true,
  status: true,
  viewCount: true,
  ratingScore: true,
  ratingCount: true,
} as const satisfies Prisma.NovelSelect;

export const LATEST_CHAPTER_SELECT = {
  id: true,
  title: true,
  position: true,
  positionEnd: true,
  premiumOnly: true,
  createdAt: true,
  volume: {
    select: {
      title: true,
      position: true,
      novel: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          status: true,
        },
      },
    },
  },
} as const satisfies Prisma.ChapterSelect;
