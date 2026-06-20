"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export function BlockedSessionLogout({ blocked }: { blocked?: boolean | null }) {
  useEffect(() => {
    if (blocked) void signOut({ callbackUrl: "/login?blocked=1" });
  }, [blocked]);

  return null;
}
