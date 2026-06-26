import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Audio Novel BR",
    short_name: "Audio Novel",
    description: "Ouça novels com áudio, texto sincronizado, assinatura premium e modo offline.",
    // id e start_url devem ser IDÊNTICOS e SEM query params
    // O browser compara a URL atual com start_url para decidir se abre standalone ou como aba
    id: "/",
    start_url: "/",
    scope: "/",
    // CRÍTICO: display DEVE ser "standalone" — não usar display_override com "browser"
    // "browser" no display_override faz o Chrome abrir como aba normal
    display: "standalone",
    orientation: "portrait",
    background_color: "#03191c",
    theme_color: "#18b7bd",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["books", "entertainment", "music"],
    prefer_related_applications: false,
    icons: [
      // Ícones padrão (any)
      { src: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png", purpose: "any" },
      { src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png", purpose: "any" },
      { src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png", purpose: "any" },
      { src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png", purpose: "any" },
      { src: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png", purpose: "any" },
      { src: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable — obrigatório para o Android usar formas adaptáveis (círculo, squircle, etc.)
      { src: "/icons/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        form_factor: "narrow",
        label: "Audio Novel BR — Catálogo de audiolivros",
      },
    ],
    shortcuts: [
      {
        name: "Novels",
        short_name: "Novels",
        description: "Explore o catálogo de novels",
        url: "/novels",
        icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
      {
        name: "Biblioteca",
        short_name: "Biblioteca",
        description: "Sua biblioteca de novels favoritas",
        url: "/biblioteca",
        icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
      {
        name: "Offline",
        short_name: "Offline",
        description: "Conteúdo disponível offline",
        url: "/offline",
        icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
    ],
  };
}
