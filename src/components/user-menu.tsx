"use client";

import Link, { useLinkStatus } from "next/link";
import { Bell, Bug, LogOut, User } from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { setBrowserAccountScope } from "@/lib/account-scope";
import { createSingleFlightGuard } from "@/lib/single-flight";

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
  const pathname = usePathname();
  const profileNavigationGuardRef = useRef(createSingleFlightGuard());
  const profileNavigationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    profileNavigationGuardRef.current.release();
    if (profileNavigationTimeoutRef.current !== null) {
      window.clearTimeout(profileNavigationTimeoutRef.current);
      profileNavigationTimeoutRef.current = null;
    }
  }, [pathname]);

  useEffect(() => () => {
    if (profileNavigationTimeoutRef.current !== null) {
      window.clearTimeout(profileNavigationTimeoutRef.current);
    }
  }, []);

  if (!user) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
      <Link
        href="/perfil"
        onNavigate={(event) => {
          if (pathname === "/perfil" || !profileNavigationGuardRef.current.tryAcquire()) {
            event.preventDefault();
            return;
          }
          profileNavigationTimeoutRef.current = window.setTimeout(() => {
            profileNavigationGuardRef.current.release();
            profileNavigationTimeoutRef.current = null;
          }, 15_000);
        }}
        className="flex min-h-10 min-w-0 items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
      >
        <ProfileLinkContent user={user} />
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
        onClick={() => {
          setBrowserAccountScope(null);
          void signOut({ callbackUrl: "/" });
        }}
        className="flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </div>
  );
}

function ProfileLinkContent({ user }: { user: NonNullable<UserMenuProps["user"]> }) {
  const { pending } = useLinkStatus();

  return (
    <>
      <User size={16} className="text-[#18b7bd]" />
      <span className="hidden max-w-28 truncate font-bold sm:inline">
        {pending ? "Abrindo..." : user.name ?? user.email}
      </span>
      <span className="hidden text-zinc-400 lg:inline">- {user.role === "ADMIN" ? "Admin" : user.plan ?? "Free"}</span>
    </>
  );
}
