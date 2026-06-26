import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },

  async headers() {
    return [
      // ── Service Worker ────────────────────────────────────────────────────
      {
        source: "/sw.js",
        headers: [
          // NUNCA cachear o SW — o browser deve sempre buscar a versão mais nova
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },

      // ── Manifest ────────────────────────────────────────────────────────────────────────────────────
      {
        source: "/manifest.webmanifest",
        headers: [
          // Sem cache para garantir que browsers sempre busquem o manifest atualizado
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
        ],
      },

      // ── Ícones PWA — cache longo (mudam raramente) ────────────────────────
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/apple-touch-icon.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/favicon-:size.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },

      // ── Página offline ────────────────────────────────────────────────────
      {
        source: "/offline-fallback.html",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },

      // ── Demais rotas — sem cache agressivo (SSR) ──────────────────────────
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
          // Headers de segurança mobile
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permite instalação PWA em todos os navegadores
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
    ];
  },
};

export default nextConfig;
