import { hasPremiumAccessAt } from "./billing";

export function hasPremiumAccess(user?: {
  role?: string | null;
  subscriptionStatus?: string | null;
  premiumUntil?: Date | string | null;
} | null) {
  return hasPremiumAccessAt(user);
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
