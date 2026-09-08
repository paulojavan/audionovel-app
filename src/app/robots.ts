import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/biblioteca", "/chapters/", "/notificacoes", "/novels", "/offline", "/perfil"],
      },
    ],
    sitemap: "https://audionovelbr.com.br/sitemap.xml",
  };
}
