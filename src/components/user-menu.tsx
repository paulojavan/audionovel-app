"use client";

import Link from "next/link";
import { Bell, Bug, LogOut, User } from "lucide-react";
import { signOut } from "next-auth/react";

type UserMenuProps = {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    plan?: string | null;
    subscriptionStatus?: string | null;
  } | null;
  unreadNotificationCount?: number;
};

export function UserMenu({ user, unreadNotificationCount = 0 }: UserMenuProps) {
  if (!user) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
      <Link href="/perfil" className="flex min-h-10 min-w-0 items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
        <User size={16} className="text-[#18b7bd]" />
        <span className="hidden max-w-28 truncate font-bold sm:inline">{user.name ?? user.email}</span>
        <span className="hidden text-zinc-400 lg:inline">- {user.role === "ADMIN" ? "Admin" : user.plan ?? "Free"}</span>
      </Link>
      <Link
        href="/notificacoes"
        className="relative flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
      >
        <Bell size={16} />
        <span className="hidden sm:inline">Notificacoes</span>
        {unreadNotificationCount ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-[#18b7bd] px-1.5 py-0.5 text-[10px] font-black text-[#021114]">
            {unreadNotificationCount}
          </span>
        ) : null}
      </Link>
      <Link
        href="/reportar-bug"
        className="flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
      >
        <Bug size={16} />
        <span className="hidden sm:inline">Bug</span>
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </div>
  );
}
