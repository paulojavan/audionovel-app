import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
import { CHAPTER_MEDIA_SOURCE_SELECT } from "./page-data-select";
import { prisma } from "./prisma";

export const getCachedChapterMedia = unstable_cache(
  async (chapterId: string) =>
    prisma.chapter.findUnique({
      where: { id: chapterId, published: true },
      select: CHAPTER_MEDIA_SOURCE_SELECT,
    }),
  ["chapter-media"],
  { revalidate: 60, tags: [CACHE_TAGS.content] },
);
