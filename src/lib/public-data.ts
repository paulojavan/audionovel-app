import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
import {
  HOME_NOVEL_SELECT,
  HOME_RANKING_NOVEL_SELECT,
  LATEST_CHAPTER_SELECT,
} from "./home-data-select";
import { buildCatalogWhere } from "./catalog-query";
import { CATALOG_NOVEL_SELECT, CATALOG_TAG_SELECT, PUBLIC_NOVEL_SELECT } from "./page-data-select";
import { prisma } from "./prisma";

export const getCachedCatalogTags = unstable_cache(
  async () =>
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: CATALOG_TAG_SELECT,
    }),
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
  async (slug: string) =>
    prisma.novel.findUnique({
      where: { slug },
      select: PUBLIC_NOVEL_SELECT,
    }),
  ["public-novel"],
  { revalidate: 60, tags: [CACHE_TAGS.content, CACHE_TAGS.tags] },
);
