import type { Prisma } from "@prisma/client";

type CatalogSearchParams = {
  q?: string;
  tag?: string;
  author?: string;
  page?: string;
};

export type CatalogFilters = {
  query: string;
  selectedTag: string;
  selectedAuthor: string;
  currentPage: number;
};

export function normalizeCatalogQuery(params: CatalogSearchParams): CatalogFilters {
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  return {
    query: (params.q?.trim() ?? "").slice(0, 100),
    selectedTag: (params.tag?.trim() ?? "").slice(0, 80),
    selectedAuthor: (params.author?.trim() ?? "").slice(0, 120),
    currentPage: Number.isSafeInteger(parsedPage) ? Math.min(10_000, Math.max(1, parsedPage)) : 1,
  };
}

export function buildCatalogWhere({
  query,
  selectedTag,
  selectedAuthor,
}: Omit<CatalogFilters, "currentPage">): Prisma.NovelWhereInput {
  return {
    AND: [
      query
        ? {
            OR: [
              { title: { contains: query } },
              { author: { contains: query } },
              { synopsis: { contains: query } },
            ],
          }
        : {},
      selectedTag ? { tags: { some: { tag: { slug: selectedTag } } } } : {},
      selectedAuthor ? { author: selectedAuthor } : {},
    ],
  };
}
