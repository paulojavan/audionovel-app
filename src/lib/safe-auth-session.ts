import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { decode, type JWT } from "next-auth/jwt";
import { cache } from "react";
import { authOptions } from "./auth";
import {
  evaluateSessionDatabaseGrace,
  isTransientPrismaSessionError,
  logSessionDatabaseFailure,
  SESSION_DATABASE_GRACE_MS,
} from "./auth-session-grace";
import { getNextAuthSessionCookieValue } from "./session-cookies";
import { hasActiveSessionUser } from "./session-state";

async function getReadableSessionToken() {
  const cookieStore = await cookies();
  const requestCookies = cookieStore.getAll();
  const sessionToken = getNextAuthSessionCookieValue(requestCookies);

  if (!sessionToken) {
    return null;
  }

  try {
    return decode({ token: sessionToken, secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "" });
  } catch {
    return null;
  }
}

function getTrustedValidationAnchor(token: JWT) {
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

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function buildSessionFromToken(token: JWT): Session | null {
  const id = getString(token.id);
  const sessionId = getString(token.sessionId);
  if (!id || !sessionId || token.sessionInvalid === true) return null;

  const expires =
    typeof token.exp === "number" && Number.isFinite(token.exp)
      ? new Date(token.exp * 1000).toISOString()
      : new Date(Date.now() + SESSION_DATABASE_GRACE_MS).toISOString();

  return {
    expires,
    user: {
      id,
      email: getString(token.email),
      name: getString(token.name),
      role: getString(token.role),
      plan: getString(token.plan),
      subscriptionStatus: getString(token.subscriptionStatus),
      premiumUntil: getString(token.premiumUntil),
      isBlocked: token.isBlocked === true,
      sessionId,
      sessionInvalid: false,
    },
  };
}

export const getSafeServerSession = cache(async function getSafeServerSession() {
  const token = await getReadableSessionToken();
  if (!token) return null;

  try {
    return await getServerSession(authOptions);
  } catch (error) {
    if (!isTransientPrismaSessionError(error)) throw error;

    const now = Date.now();
    const grace = evaluateSessionDatabaseGrace({
      now,
      lastValidatedAt: getTrustedValidationAnchor(token),
      sessionInvalid: token.sessionInvalid === true,
    });

    logSessionDatabaseFailure({
      error,
      operation: "user_state_refresh",
      graceApplied: grace.allowed,
      remainingMs: grace.remainingMs,
      now,
    });

    if (grace.allowed) return buildSessionFromToken(token);
    return null;
  }
});

export const getActiveServerSession = cache(async function getActiveServerSession() {
  const session = await getSafeServerSession();
  return hasActiveSessionUser(session) ? session : null;
});
