"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CreditCard, Download, Home, Library, Search, Shield } from "lucide-react";

type MobileAppNavProps = {
  role?: string | null;
  showSubscriptionsLink: boolean;
  unreadNotificationCount?: number;
};

export function MobileAppNav({ role, showSubscriptionsLink, unreadNotificationCount = 0 }: MobileAppNavProps) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/novels", label: "Novels", icon: Search },
    { href: "/biblioteca", label: "Biblioteca", icon: Library },
    { href: "/offline", label: "Offline", icon: Download },
    { href: "/notificacoes", label: "Avisos", icon: Bell, badge: unreadNotificationCount },
    ...(showSubscriptionsLink ? [{ href: "/assinaturas", label: "Planos", icon: CreditCard }] : []),
    ...(role === "ADMIN" ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#020809]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur md:hidden">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-h-14 min-w-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-black ${
                active ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300 hover:bg-white/10"
              }`}
            >
              <Icon size={19} />
              <span>{item.label}</span>
              {item.badge ? (
                <span className="absolute right-2 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
