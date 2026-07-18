import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createAsyncTtlCache } from "./async-ttl-cache";
import { logSessionDatabaseFailure } from "./auth-session-grace";
import { refreshEstablishedSession } from "./auth-session-refresh";
import type { RefreshedUserState } from "./auth-session-refresh";
import { getDeviceIdFromToken } from "./device-identity";
import { createDeviceSession, revokeDeviceSession, validateDeviceSession } from "./device-session";
import { verifyPassword } from "./password";
import { prisma } from "./prisma";
import { consumeRateLimit, getRequestIdentifierFromHeaders } from "./rate-limit";

const SESSION_VALIDATION_INTERVAL_MS = 30_000;

const deviceSessionRefreshCache = createAsyncTtlCache<
  string,
  Awaited<ReturnType<typeof validateDeviceSession>>
>({
  ttlMs: 0,
  maxEntries: 1_024,
});

const userStateRefreshCache = createAsyncTtlCache<
  string,
  RefreshedUserState | null
>({
  ttlMs: 0,
  maxEntries: 1_024,
});

type AuthRequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email e senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
        deviceToken: { label: "Token do dispositivo", type: "text" },
        deviceName: { label: "Nome do dispositivo", type: "text" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        const deviceId = getDeviceIdFromToken(credentials?.deviceToken);
        const deviceName = credentials?.deviceName?.trim();

        if (!email || !password || !deviceId) return null;

        const requestIdentifier = getRequestIdentifierFromHeaders(
          (request as AuthRequestLike | undefined)?.headers,
        );
        const [ipLimit, emailLimit] = await Promise.all([
          consumeRateLimit({ key: `login:ip:${requestIdentifier}`, limit: 12, windowMs: 15 * 60_000 }),
          consumeRateLimit({ key: `login:email:${email}`, limit: 8, windowMs: 15 * 60_000 }),
        ]);
        if (!ipLimit.allowed || !emailLimit.allowed) {
          throw new Error("RATE_LIMITED");
        }

        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (!dbUser || dbUser.isBlocked) return null;

        const validPassword = await verifyPassword(password, dbUser.passwordHash);
        if (!validPassword) return null;

        const deviceSession = await createDeviceSession({
          userId: dbUser.id,
          deviceId,
          deviceName,
          headers: (request as AuthRequestLike | undefined)?.headers,
        });

        if (!deviceSession.allowed) {
          throw new Error("DEVICE_LIMIT_EXCEEDED");
        }

        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          plan: dbUser.plan,
          subscriptionStatus: dbUser.subscriptionStatus,
          premiumUntil: dbUser.premiumUntil?.toISOString() ?? null,
          isBlocked: dbUser.isBlocked,
          sessionId: deviceSession.sessionId,
          sessionInvalid: false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: {
            id: true,
            role: true,
            plan: true,
            subscriptionStatus: true,
            premiumUntil: true,
            isBlocked: true,
          },
        });

        token.id = dbUser?.id ?? user.id;
        token.role = dbUser?.role ?? user.role;
        token.plan = dbUser?.plan ?? user.plan;
        token.subscriptionStatus = dbUser?.subscriptionStatus ?? user.subscriptionStatus;
        token.premiumUntil = dbUser?.premiumUntil?.toISOString() ?? user.premiumUntil;
        token.isBlocked = dbUser?.isBlocked ?? user.isBlocked;
        token.sessionId = user.sessionId ?? token.sessionId;
        token.sessionInvalid = user.sessionInvalid ?? false;
        token.sessionCheckedAt = 0;
      }

      if (token.id && !token.sessionId) {
        token.sessionInvalid = true;
        token.id = undefined;
        return token;
      }

      await refreshEstablishedSession({
        token,
        validationIntervalMs: SESSION_VALIDATION_INTERVAL_MS,
        now: Date.now,
        validateDeviceSession: (sessionId) =>
          deviceSessionRefreshCache.get(sessionId, () =>
            validateDeviceSession(sessionId),
          ),
        findUserState: (userId) =>
          userStateRefreshCache.get(userId, () =>
            prisma.user.findUnique({
              where: { id: userId },
              select: {
                email: true,
                isBlocked: true,
                name: true,
                plan: true,
                role: true,
                subscriptionStatus: true,
                premiumUntil: true,
              },
            }),
          ),
        logDatabaseFailure: logSessionDatabaseFailure,
      });

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.user.plan = token.plan as string;
        session.user.subscriptionStatus = token.subscriptionStatus as string;
        session.user.premiumUntil = token.premiumUntil as string | null;
        session.user.isBlocked = Boolean(token.isBlocked);
        session.user.sessionId = token.sessionId as string | null;
        session.user.sessionInvalid = Boolean(token.sessionInvalid);
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      await revokeDeviceSession(token?.sessionId);
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
