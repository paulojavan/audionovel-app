import {
  SESSION_DATABASE_GRACE_MS,
  evaluateSessionDatabaseGrace,
  isTransientPrismaSessionError,
} from "./auth-session-grace";

export type EstablishedSessionToken = {
  id?: string | null;
  sessionId?: string | null;
  sessionInvalid?: boolean | null;
  sessionCheckedAt?: number | null;
  sessionValidatedAt?: number | null;
  email?: string | null;
  isBlocked?: boolean | null;
  name?: string | null;
  plan?: string | null;
  role?: string | null;
  subscriptionStatus?: string | null;
  premiumUntil?: string | null;
};

export type RefreshedUserState = {
  email: string | null;
  isBlocked: boolean;
  name: string | null;
  plan: string;
  role: string;
  subscriptionStatus: string;
  premiumUntil: Date | null;
};

type DatabaseFailure = {
  error: unknown;
  operation: "device_session_validation" | "user_state_refresh";
  graceApplied: boolean;
  remainingMs: number;
  now: number;
};

type RefreshEstablishedSessionOptions = {
  token: EstablishedSessionToken;
  validationIntervalMs: number;
  now: () => number;
  validateDeviceSession: (sessionId: string) => Promise<{ valid: boolean }>;
  findUserState: (userId: string) => Promise<RefreshedUserState | null>;
  logDatabaseFailure: (failure: DatabaseFailure) => void;
};

function getTrustedValidationAnchor(token: EstablishedSessionToken): number | null {
  if (
    typeof token.sessionValidatedAt === "number" &&
    Number.isFinite(token.sessionValidatedAt) &&
    token.sessionValidatedAt > 0
  ) {
    return token.sessionValidatedAt;
  }

  if (
    token.sessionValidatedAt == null &&
    typeof token.sessionCheckedAt === "number" &&
    Number.isFinite(token.sessionCheckedAt) &&
    token.sessionCheckedAt > 0
  ) {
    return token.sessionCheckedAt;
  }

  return null;
}

export async function refreshEstablishedSession({
  token,
  validationIntervalMs,
  now: readNow,
  validateDeviceSession,
  findUserState,
  logDatabaseFailure,
}: RefreshEstablishedSessionOptions): Promise<EstablishedSessionToken> {
  if (!token.sessionId) {
    return token;
  }

  const now = readNow();
  const lastValidatedAt = getTrustedValidationAnchor(token);
  const lastCheckedAt =
    typeof token.sessionCheckedAt === "number" &&
    Number.isFinite(token.sessionCheckedAt) &&
    token.sessionCheckedAt > 0 &&
    token.sessionCheckedAt <= now
      ? token.sessionCheckedAt
      : null;
  const graceExpired =
    lastValidatedAt !== null &&
    now - lastValidatedAt >= SESSION_DATABASE_GRACE_MS;
  if (
    token.sessionInvalid !== true &&
    lastCheckedAt !== null &&
    now - lastCheckedAt < validationIntervalMs &&
    !graceExpired
  ) {
    return token;
  }

  if (token.sessionValidatedAt == null && lastValidatedAt !== null) {
    token.sessionValidatedAt = lastValidatedAt;
  }

  const evaluateGrace = (error: unknown) => {
    if (
      !token.id ||
      !token.sessionId ||
      token.sessionInvalid === true ||
      !isTransientPrismaSessionError(error)
    ) {
      return { allowed: false, remainingMs: 0 };
    }

    return evaluateSessionDatabaseGrace({
      now,
      lastValidatedAt,
      sessionInvalid: false,
    });
  };

  let deviceSession: { valid: boolean };
  try {
    deviceSession = await validateDeviceSession(token.sessionId);
  } catch (error) {
    const grace = evaluateGrace(error);
    logDatabaseFailure({
      error,
      operation: "device_session_validation",
      graceApplied: grace.allowed,
      remainingMs: grace.remainingMs,
      now,
    });
    if (!grace.allowed) {
      throw error;
    }

    token.sessionCheckedAt = now;
    return token;
  }

  token.sessionCheckedAt = now;
  if (!deviceSession.valid) {
    token.sessionInvalid = true;
    token.id = undefined;
    return token;
  }

  token.sessionInvalid = false;
  if (!token.id) {
    return token;
  }

  let userState: RefreshedUserState | null;
  try {
    userState = await findUserState(token.id);
  } catch (error) {
    const grace = evaluateGrace(error);
    logDatabaseFailure({
      error,
      operation: "user_state_refresh",
      graceApplied: grace.allowed,
      remainingMs: grace.remainingMs,
      now,
    });
    if (!grace.allowed) {
      throw error;
    }

    return token;
  }

  token.email = userState?.email ?? token.email;
  token.isBlocked = userState?.isBlocked ?? true;
  token.name = userState?.name ?? token.name;
  token.plan = userState?.plan ?? token.plan;
  token.role = userState?.role ?? token.role;
  token.subscriptionStatus =
    userState?.subscriptionStatus ?? token.subscriptionStatus;
  token.premiumUntil =
    userState?.premiumUntil?.toISOString() ?? token.premiumUntil;
  token.sessionValidatedAt = now;

  return token;
}
