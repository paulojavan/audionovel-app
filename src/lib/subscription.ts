export function hasPremiumAccess(user?: {
  role?: string | null;
  subscriptionStatus?: string | null;
  premiumUntil?: Date | string | null;
} | null) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.subscriptionStatus === "ACTIVE") return true;
  if (!user.premiumUntil) return false;
  return new Date(user.premiumUntil).getTime() > Date.now();
}

export function assertSameUserOrAdmin(
  sessionUserId: string | undefined,
  targetUserId: string,
  role?: string | null,
) {
  if (!sessionUserId || (sessionUserId !== targetUserId && role !== "ADMIN")) {
    throw new Error("FORBIDDEN");
  }
}
