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
      sessionUnavailable: false,
    },
  };
}

export class AuthSessionUnavailableError extends Error {
  constructor() {
    super("Nao foi possivel verificar a sessao no banco de dados.");
    this.name = "AuthSessionUnavailableError";
  }
}

export const getSafeServerSession = cache(async function getSafeServerSession() {
  const token = await getReadableSessionToken();
  if (!token) return null;

  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.sessionUnavailable) {
      throw new AuthSessionUnavailableError();
    }
    if (session) return session;

    // O NextAuth 4 captura erros do callback JWT internamente e devolve null.
    // Um JWT ainda legivel e completo nao deve virar "deslogado" por causa de
    // uma oscilacao do banco: usamos a mesma ancora curta de seguranca e,
    // depois dela, exibimos indisponibilidade em vez da tela de login.
    const fallback = buildSessionFromToken(token);
    if (!fallback) return null;

    const now = Date.now();
    const grace = evaluateSessionDatabaseGrace({
      now,
      lastValidatedAt: getTrustedValidationAnchor(token),
      sessionInvalid: token.sessionInvalid === true,
    });
    if (grace.allowed) return fallback;
    throw new AuthSessionUnavailableError();
  } catch (error) {
    if (error instanceof AuthSessionUnavailableError) throw error;
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
    throw new AuthSessionUnavailableError();
  }
});

export const getActiveServerSession = cache(async function getActiveServerSession() {
  const session = await getSafeServerSession();
  return hasActiveSessionUser(session) ? session : null;
});
