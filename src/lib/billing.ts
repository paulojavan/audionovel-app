export const PREMIUM_ACCESS_STATUSES = new Set(["ACTIVE", "TRIALING"]);

type PremiumAccessUser = {
  role?: string | null;
  subscriptionStatus?: string | null;
  premiumUntil?: Date | string | null;
};

export function hasPremiumAccessAt(user: PremiumAccessUser | null | undefined, now = new Date()) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (!user.subscriptionStatus || !PREMIUM_ACCESS_STATUSES.has(user.subscriptionStatus)) return false;
  if (!user.premiumUntil) return false;

  const premiumUntil = new Date(user.premiumUntil);
  if (Number.isNaN(premiumUntil.getTime())) return false;

  return premiumUntil.getTime() > now.getTime();
}

export function calculateFixedPremiumUntil(currentPremiumUntil: Date | string | null | undefined, premiumDays: number, now = new Date()) {
  const current = currentPremiumUntil ? new Date(currentPremiumUntil) : null;
  const base = current && current.getTime() > now.getTime() ? current : now;
  const next = new Date(base);
  next.setDate(next.getDate() + premiumDays);
  return next;
}
