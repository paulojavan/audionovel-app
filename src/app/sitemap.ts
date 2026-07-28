import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE_ORIGIN = "https://audionovelbr.com.br";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [novels, chapters] = await Promise.all([
    prisma.novel.findMany({
      take: 20_000,
      orderBy: { updatedAt: "desc" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.chapter.findMany({
      where: { published: true },
      take: 20_000,
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true },
    }),
  ]);

  return [
    { url: SITE_ORIGIN, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_ORIGIN}/novels`, changeFrequency: "daily", priority: 0.9 },
    ...novels.map((novel) => ({
      url: `${SITE_ORIGIN}/novels/${novel.slug}`,
      lastModified: novel.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...chapters.map((chapter) => ({
      url: `${SITE_ORIGIN}/chapters/${chapter.id}`,
      lastModified: chapter.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
