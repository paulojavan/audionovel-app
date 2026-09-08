import type { MetadataRoute } from "next";

const SITE_ORIGIN = "https://audionovelbr.com.br";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: SITE_ORIGIN, changeFrequency: "daily", priority: 1 },
  ];
}
