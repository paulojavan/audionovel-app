import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { decode } from "next-auth/jwt";
import { authOptions } from "./auth";
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

export async function getSafeServerSession() {
  if (!(await hasReadableSessionToken())) return null;

  return getServerSession(authOptions);
}
