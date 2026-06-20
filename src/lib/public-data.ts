import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
import { prisma } from "./prisma";

export const getCachedCatalogTags = unstable_cache(
  async () => prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ["catalog-tags"],
  { revalidate: 300, tags: [CACHE_TAGS.tags] },
);

export const getCachedHomeData = unstable_cache(
  async () => {
    const [novels, rankingByViews, rankingByRating] = await Promise.all([
      prisma.novel.findMany({
        take: 12,
        include: { volumes: { include: { chapters: { take: 1, orderBy: { position: "asc" } } } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.novel.findMany({ take: 8, orderBy: { viewCount: "desc" } }),
      prisma.novel.findMany({ take: 8, orderBy: { ratingScore: "desc" } }),
    ]);

    return { novels, rankingByViews, rankingByRating };
  },
  ["home-data"],
  { revalidate: 60, tags: [CACHE_TAGS.content] },
);
