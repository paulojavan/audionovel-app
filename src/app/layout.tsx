import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Bell, Bug, CreditCard, Download, Home, Library, Search, Shield } from "lucide-react";
import { getCachedUnreadNotificationCount } from "@/lib/notifications";
import { getActiveServerSession } from "@/lib/safe-auth-session";
import {
  getPremiumDaysLabel,
  getSubscriptionDisplayState,
  hasPremiumAccess,
} from "@/lib/subscription";
import { BlockedSessionLogout } from "@/components/blocked-session-logout";
import { MobileAppNav } from "@/components/mobile-app-nav";
import { PwaLifecycle } from "@/components/pwa-lifecycle";
import { PwaInstallMenuItem } from "@/components/pwa-install-menu-item";
import { PwaOfflineNavigation } from "@/components/pwa-offline-navigation";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { SessionHeartbeat } from "@/components/session-heartbeat";
import { UserMenu } from "@/components/user-menu";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://audionovelbr.com.br"),
  applicationName: "Audio Novel BR",
  title: {
    default: "Audio Novel BR",
    template: "%s | Audio Novel BR",
  },
  description: "Ouça novels com áudio, texto sincronizado, assinatura premium e modo offline. Plataforma brasileira de audiolivros e web novels.",
  manifest: "/manifest.webmanifest",
  keywords: ["audio novel", "audiolivro", "web novel", "novels brasileiras", "ouvir novel"],
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon-32x32.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Audio Novel BR",
    statusBarStyle: "black-translucent",
    startupImage: [
      {
        url: "/icons/icon-512x512.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#03191c",
    "msapplication-TileImage": "/icons/icon-144x144.png",
    "msapplication-config": "none",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#03191c" },
    { media: "(prefers-color-scheme: light)", color: "#18b7bd" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getActiveServerSession();
  const activeSession = session?.user?.isBlocked ? null : session;
  const unreadNotificationCount = activeSession?.user?.id
    ? await getCachedUnreadNotificationCount(activeSession.user.id)
    : 0;
  const showSubscriptionsLink = !activeSession?.user || !hasPremiumAccess(activeSession.user);
  const premiumDaysLabel = getPremiumDaysLabel(activeSession?.user);
  const subscriptionDisplay = getSubscriptionDisplayState(activeSession?.user);

  return (
    <html lang="pt-BR">
      <head>
        <meta
          name="audio-novel-account-scope"
          content={activeSession?.user?.id ?? "anonymous"}
        />
      </head>
      <body>
        <ServiceWorkerRegister accountScope={activeSession?.user?.id} />
        <PwaOfflineNavigation />
        <PwaLifecycle />
        <BlockedSessionLogout blocked={session?.user?.isBlocked} />
        {activeSession ? <SessionHeartbeat /> : null}
        {!activeSession?.user ? (
          <main className="min-h-screen">{children}</main>
        ) : (
          <div className="grid min-h-screen grid-cols-1 bg-[#020b0d] text-zinc-50 md:grid-cols-[240px_1fr]">
            <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-white/10 bg-[#020809] p-5 md:flex">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo-audio-novel-br.png"
                  alt="Audio Novel BR"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-md object-cover ring-1 ring-[#18b7bd]/40"
                  priority
                />
                <span className="text-xl font-black leading-tight tracking-tight">
                  Audio
                  <span className="block text-[#22d3dc]">Novel BR</span>
                </span>
              </Link>
              <nav className="grid gap-2 text-sm font-semibold text-zinc-300">
                <Link className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/10" href="/">
                  <Home size={18} /> Inicio
                </Link>
                <Link className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/10" href="/novels">
                  <Search size={18} /> Novels
                </Link>
                <Link className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/10" href="/biblioteca">
                  <Library size={18} /> Biblioteca
                </Link>
                {activeSession?.user ? (
                  <Link className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/10" href="/offline">
                    <Download size={18} /> Offline
                  </Link>
                ) : null}
                <PwaInstallMenuItem variant="sidebar" />
                {activeSession?.user ? (
                  <Link className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/10" href="/notificacoes">
                    <Bell size={18} /> Notificacoes
                    {unreadNotificationCount ? <span className="ml-auto rounded-full bg-[#18b7bd] px-2 py-0.5 text-xs font-black text-[#021114]">{unreadNotificationCount}</span> : null}
                  </Link>
                ) : null}
                {activeSession?.user ? (
                  <Link className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/10" href="/reportar-bug">
                    <Bug size={18} /> Reportar bug
                  </Link>
                ) : null}
                {showSubscriptionsLink ? (
                  <Link className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/10" href="/assinaturas">
                    <CreditCard size={18} /> Assinaturas
                  </Link>
                ) : null}
                {activeSession?.user?.role === "ADMIN" ? (
                  <Link className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/10" href="/admin">
                    <Shield size={18} /> Admin
                  </Link>
                ) : null}
              </nav>
            </aside>
            <main className="min-w-0 pb-32 md:pb-24">
              <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/10 bg-[#020809]/90 px-4 py-3 backdrop-blur md:px-8">
                <Link href="/" className="flex items-center gap-2 font-black tracking-tight md:hidden">
                  <Image
                    src="/logo-audio-novel-br.png"
                    alt="Audio Novel BR"
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded object-cover"
                  />
                  <span className="text-sm text-[#8ff7ff]">{premiumDaysLabel}</span>
                </Link>
                <div className="hidden text-sm font-bold text-[#8ff7ff] md:block">
                  {premiumDaysLabel}
                </div>
                {activeSession?.user ? (
                  <UserMenu
                    user={activeSession.user}
                    planLabel={subscriptionDisplay.planLabel}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Link className="rounded-full px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10" href="/cadastro">
                      Criar conta
                    </Link>
                    <Link className="rounded-full bg-[#18b7bd] px-4 py-2 text-sm font-bold text-[#021114]" href="/login">
                      Entrar
                    </Link>
                  </div>
                )}
              </header>
              {children}
            </main>
            <MobileAppNav
              role={activeSession.user.role}
              showSubscriptionsLink={showSubscriptionsLink}
              unreadNotificationCount={unreadNotificationCount}
            />
          </div>
        )}
      </body>
    </html>
  );
}
