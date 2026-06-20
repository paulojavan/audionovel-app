import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { decode } from "next-auth/jwt";
import { cache } from "react";
import { authOptions } from "./auth";
import { validateDeviceSession } from "./device-session";
import { prisma } from "./prisma";
import { getNextAuthSessionCookieValue } from "./session-cookies";

async function hasReadableSessionToken() {
  const cookieStore = await cookies();
  const requestCookies = cookieStore.getAll();
  const sessionToken = getNextAuthSessionCookieValue(requestCookies);

  if (!sessionToken) {
    return false;
  }

  try {
    return Boolean(await decode({ token: sessionToken, secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "" }));
  } catch {
    return false;
  }
}

export const getSafeServerSession = cache(async function getSafeServerSession() {
  if (!(await hasReadableSessionToken())) return null;

  return getServerSession(authOptions);
});

export const getActiveServerSession = cache(async function getActiveServerSession() {
  const session = await getSafeServerSession();
  if (!session?.user?.id) return null;

  const headerStore = await headers();
  const sessionValidation = await validateDeviceSession(session.user.sessionId, Object.fromEntries(headerStore));

  if (!sessionValidation.valid) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      subscriptionStatus: true,
      premiumUntil: true,
      isBlocked: true,
    },
  });

  if (!user) return null;

  return {
    ...session,
    user: {
      ...session.user,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      premiumUntil: user.premiumUntil?.toISOString() ?? null,
      isBlocked: user.isBlocked,
    },
  };
});
