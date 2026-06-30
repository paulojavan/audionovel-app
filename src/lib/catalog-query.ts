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
  return {
    query: params.q?.trim() ?? "",
    selectedTag: params.tag?.trim() ?? "",
    selectedAuthor: params.author?.trim() ?? "",
    currentPage: Math.max(1, Number(params.page ?? 1) || 1),
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
