import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/novels/", "/chapters/"],
        disallow: ["/admin/", "/api/", "/biblioteca", "/notificacoes", "/offline", "/perfil"],
      },
    ],
    sitemap: "https://audionovelbr.com.br/sitemap.xml",
  };
}
