import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Audio Novel BR",
    short_name: "Audio Novel",
    description: "Ouça novels com áudio, texto sincronizado, assinatura premium e modo offline.",
    id: "/?source=pwa",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
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
      // Ícone maskable — usado pelo Android/Chrome para formas adaptáveis
      { src: "/icons/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      // Apple touch icon via manifest (complementa o <link> no head)
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    screenshots: [
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        form_factor: "narrow",
        label: "Audio Novel BR — Catálogo de audiolivros",
      },
      {
        src: "/icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
        form_factor: "narrow",
        label: "Audio Novel BR — Player de áudio integrado",
      },
    ],
    shortcuts: [
      {
        name: "Novels",
        short_name: "Novels",
        description: "Explore o catálogo de novels",
        url: "/novels?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
      {
        name: "Biblioteca",
        short_name: "Biblioteca",
        description: "Sua biblioteca de novels favoritas",
        url: "/biblioteca?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
      {
        name: "Offline",
        short_name: "Offline",
        description: "Conteúdo disponível offline",
        url: "/offline?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
      },
    ],
  };
}
