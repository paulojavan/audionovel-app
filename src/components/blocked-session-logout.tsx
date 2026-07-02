"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { setBrowserAccountScope } from "@/lib/account-scope";

export function BlockedSessionLogout({ blocked }: { blocked?: boolean | null }) {
  useEffect(() => {
    if (blocked) {
      setBrowserAccountScope(null);
      void signOut({ callbackUrl: "/login?blocked=1" });
    }
  }, [blocked]);

  return null;
}
