import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";
const allowedImageHosts = Array.from(
  new Set(
    [
      "images.unsplash.com",
      "i0.wp.com",
      "i1.wp.com",
      "i2.wp.com",
      "i3.wp.com",
      ...(process.env.IMAGE_URL_ALLOWED_HOSTS ?? "").split(","),
    ]
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  ),
);
const imageSources = allowedImageHosts.map((host) => `https://${host}`).join(" ");
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${imageSources}`,
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self' https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: allowedImageHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()" },
          ...(isProduction
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
          // Permite instalação PWA em todos os navegadores
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
    ];
  },
};

export default nextConfig;
