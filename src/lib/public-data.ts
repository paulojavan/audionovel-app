import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
import {
  HOME_NOVEL_SELECT,
  HOME_RANKING_NOVEL_SELECT,
  LATEST_CHAPTER_SELECT,
} from "./home-data-select";
import { prisma } from "./prisma";

export const getCachedCatalogTags = unstable_cache(
  async () => prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ["catalog-tags"],
  { revalidate: 300, tags: [CACHE_TAGS.tags] },
);

export const getCachedHomeData = unstable_cache(
  async () => {
    const [novels, rankingByViews, rankingByRating, latestChapters] = await Promise.all([
      prisma.novel.findMany({
        take: 12,
        select: HOME_NOVEL_SELECT,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.novel.findMany({
        take: 8,
        select: HOME_RANKING_NOVEL_SELECT,
        orderBy: { viewCount: "desc" },
      }),
      prisma.novel.findMany({
        take: 8,
        select: HOME_RANKING_NOVEL_SELECT,
        orderBy: { ratingScore: "desc" },
      }),
      prisma.chapter.findMany({
        where: { published: true },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: LATEST_CHAPTER_SELECT,
      }),
    ]);

    return { novels, rankingByViews, rankingByRating, latestChapters };
  },
  ["home-data"],
  { revalidate: 60, tags: [CACHE_TAGS.content] },
);
