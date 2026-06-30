import { hasPremiumAccessAt } from "./billing";

const DAY_MS = 86_400_000;

export function hasPremiumAccess(user?: {
  role?: string | null;
  subscriptionStatus?: string | null;
  premiumUntil?: Date | string | null;
} | null, now = new Date()) {
  return hasPremiumAccessAt(user, now);
}

export function getRemainingPremiumDays(
  premiumUntil: Date | string | null | undefined,
  now = new Date(),
) {
  if (!premiumUntil) return 0;

  const expiresAt = new Date(premiumUntil);
  if (Number.isNaN(expiresAt.getTime())) return 0;

  return Math.max(
    0,
    Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS),
  );
}

export function formatPremiumDaysLabel(days: number) {
  return `${days} ${days === 1 ? "dia" : "dias"} de Premium`;
}

export function getPremiumDaysLabel(
  user?: {
    role?: string | null;
    subscriptionStatus?: string | null;
    premiumUntil?: Date | string | null;
  } | null,
  now = new Date(),
) {
  const days = hasPremiumAccess(user, now)
    ? getRemainingPremiumDays(user?.premiumUntil, now)
    : 0;

  return formatPremiumDaysLabel(days);
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
