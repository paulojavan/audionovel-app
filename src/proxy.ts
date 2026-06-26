import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearNextAuthSessionCookies, hasNextAuthSessionCookie } from "./lib/session-cookies";
import { isDecodedSessionTokenUsable } from "./lib/session-token";

const publicPages = new Set(["/", "/login", "/cadastro", "/recuperar-senha", "/redefinir-senha"]);
const publicApiPrefixes = ["/api/auth", "/api/register", "/api/password-reset"];
const publicApiSuffixes = ["/api/billing/webhook", "/api/billing/return"];
const publicFiles = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/logo-audio-novel-br.png",
  "/offline-fallback.html",
  "/sw.js",
]);

function isPublicPath(pathname: string) {
  if (publicPages.has(pathname)) return true;
  if (publicFiles.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/images/")) return true;
  if (publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))) return true;
  if (publicApiSuffixes.some((suffix) => pathname.startsWith(suffix))) return true;
  return /\.(png|jpg|jpeg|webp|svg|ico|css|js|map|txt|xml|webmanifest)$/i.test(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  const hasSessionCookie = hasNextAuthSessionCookie(cookieNames);
  const token = hasSessionCookie ? await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }) : null;
  const hasInvalidSessionCookie = hasSessionCookie && !token;

  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    if (hasInvalidSessionCookie) clearNextAuthSessionCookies(response, cookieNames);
    return response;
  }

  if (isDecodedSessionTokenUsable(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json(
      { error: token?.isBlocked ? "Usuario bloqueado." : "Autenticacao obrigatoria." },
      { status: token?.isBlocked ? 403 : 401 },
    );
    if (hasInvalidSessionCookie) clearNextAuthSessionCookies(response, cookieNames);
    return response;
  }

  const loginUrl = new URL("/login", request.url);
  if (token?.isBlocked) {
    loginUrl.searchParams.set("blocked", "1");
  }
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  const response = NextResponse.redirect(loginUrl);
  if (hasInvalidSessionCookie) clearNextAuthSessionCookies(response, cookieNames);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
