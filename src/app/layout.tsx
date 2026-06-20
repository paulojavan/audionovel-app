import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Bell, CreditCard, Download, Home, Library, Search, Shield, User } from "lucide-react";
import { getCachedUnreadNotificationCount } from "@/lib/notifications";
import { getActiveServerSession } from "@/lib/safe-auth-session";
import { hasPremiumAccess } from "@/lib/subscription";
import { BlockedSessionLogout } from "@/components/blocked-session-logout";
import { MobileAppNav } from "@/components/mobile-app-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { UserMenu } from "@/components/user-menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "Áudio Novel BR",
  description: "Ouça novels com áudio, texto sincronizado, assinatura premium e modo offline.",
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

  return (
    <html lang="pt-BR">
      <body>
        <ServiceWorkerRegister />
        <BlockedSessionLogout blocked={session?.user?.isBlocked} />
        {!activeSession?.user ? (
          <main className="min-h-screen">{children}</main>
        ) : (
          <div className="grid min-h-screen grid-cols-1 bg-[#020b0d] text-zinc-50 md:grid-cols-[240px_1fr]">
            <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-white/10 bg-[#020809] p-5 md:flex">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo-audio-novel-br.png"
                  alt="Áudio Novel BR"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-md object-cover ring-1 ring-[#18b7bd]/40"
                  priority
                />
                <span className="text-xl font-black leading-tight tracking-tight">
                  Áudio
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
              {activeSession?.user ? (
                <Link className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/10" href="/notificacoes">
                  <Bell size={18} /> Notificacoes
                  {unreadNotificationCount ? <span className="ml-auto rounded-full bg-[#18b7bd] px-2 py-0.5 text-xs font-black text-[#021114]">{unreadNotificationCount}</span> : null}
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
            <div className="mt-auto rounded-md bg-[#06272b] p-4 text-sm text-zinc-300">
              {activeSession?.user ? (
                <Link className="flex items-center gap-2" href="/perfil">
                  <User size={18} /> {activeSession.user.name}
                </Link>
              ) : (
                <Link className="rounded-full bg-[#18b7bd] px-4 py-2 font-bold text-[#021114]" href="/login">
                  Entrar
                </Link>
              )}
            </div>
          </aside>
          <main className="min-w-0 pb-32 md:pb-24">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/10 bg-[#020809]/90 px-4 py-3 backdrop-blur md:px-8">
              <Link href="/" className="flex items-center gap-2 font-black tracking-tight md:hidden">
                <Image
                  src="/logo-audio-novel-br.png"
                  alt="Áudio Novel BR"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded object-cover"
                />
                <span>Áudio Novel BR</span>
              </Link>
              <div className="hidden text-sm text-zinc-400 md:block">{activeSession?.user ? "Sessao ativa" : "Voce ainda nao entrou"}</div>
              {activeSession?.user ? (
                <UserMenu user={activeSession.user} unreadNotificationCount={unreadNotificationCount} />
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
