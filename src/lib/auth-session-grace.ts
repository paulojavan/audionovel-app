const TRANSIENT_PRISMA_SESSION_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
  "P2037",
]);

export const SESSION_DATABASE_GRACE_MS = 5 * 60_000;

export function getPrismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

export function isTransientPrismaSessionError(error: unknown): boolean {
  const code = getPrismaErrorCode(error);
  return Boolean(code && TRANSIENT_PRISMA_SESSION_CODES.has(code));
}

export function evaluateSessionDatabaseGrace({
  now,
  lastValidatedAt,
  sessionInvalid,
}: {
  now: number;
  lastValidatedAt: number | null;
  sessionInvalid: boolean;
}): { allowed: boolean; remainingMs: number } {
  if (
    sessionInvalid ||
    !Number.isFinite(now) ||
    lastValidatedAt === null ||
    !Number.isFinite(lastValidatedAt)
  ) {
    return { allowed: false, remainingMs: 0 };
  }

  const elapsedMs = now - lastValidatedAt;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return { allowed: false, remainingMs: 0 };
  }

  const remainingMs = Math.max(0, SESSION_DATABASE_GRACE_MS - elapsedMs);
  return { allowed: remainingMs > 0, remainingMs };
}
