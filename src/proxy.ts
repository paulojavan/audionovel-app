import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearNextAuthSessionCookies, hasNextAuthSessionCookie } from "./lib/session-cookies";
import { isDecodedSessionTokenUsable } from "./lib/session-token";
import { hashSessionValue } from "./lib/session-fingerprint";

const publicPages = new Set(["/", "/login", "/cadastro", "/recuperar-senha", "/redefinir-senha"]);
const publicPagePrefixes = ["/novels", "/chapters"];
const publicApiPrefixes = ["/api/auth", "/api/register", "/api/password-reset", "/api/chapters"];
const publicApiSuffixes = ["/api/billing/webhook", "/api/billing/return"];
const publicFiles = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/logo-audio-novel-br.png",
  "/offline-fallback.html",
  "/loading-fallback.html",
  "/sw.js",
]);

function createRequestSecurityHeaders(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'self' https://www.youtube-nocookie.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  return { csp, requestHeaders };
}

function secureResponse(response: NextResponse, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function isPublicPath(pathname: string) {
  if (publicPages.has(pathname)) return true;
  if (publicPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  if (publicFiles.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/images/")) return true;
  if (publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))) return true;
  if (publicApiSuffixes.some((suffix) => pathname.startsWith(suffix))) return true;
  return /\.(png|jpg|jpeg|webp|svg|ico|css|js|map|txt|xml|webmanifest)$/i.test(pathname);
}

export function isUnexpectedServerActionRequest(headers: Headers) {
  return headers.has("next-action");
}

export async function proxy(request: NextRequest) {
  const { csp, requestHeaders } = createRequestSecurityHeaders(request);

  if (isUnexpectedServerActionRequest(request.headers)) {
    return secureResponse(NextResponse.json({ error: "Rota nao encontrada." }, { status: 404 }), csp);
  }

  const { pathname, search } = request.nextUrl;
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  const hasSessionCookie = hasNextAuthSessionCookie(cookieNames);
  const token = hasSessionCookie ? await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }) : null;
  const userAgentHash = request.headers.get("user-agent")
    ? hashSessionValue(request.headers.get("user-agent")!)
    : null;
  const userAgentMatches =
    !token?.userAgentHash || !userAgentHash || token.userAgentHash === userAgentHash;
  const hasInvalidSessionCookie = hasSessionCookie && (!token || !userAgentMatches);

  if (isPublicPath(pathname)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (hasInvalidSessionCookie) clearNextAuthSessionCookies(response, cookieNames);
    return secureResponse(response, csp);
  }

  if (userAgentMatches && isDecodedSessionTokenUsable(token)) {
    return secureResponse(NextResponse.next({ request: { headers: requestHeaders } }), csp);
  }

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json(
      { error: token?.isBlocked ? "Usuario bloqueado." : "Autenticacao obrigatoria." },
      { status: token?.isBlocked ? 403 : 401 },
    );
    if (hasInvalidSessionCookie) clearNextAuthSessionCookies(response, cookieNames);
    return secureResponse(response, csp);
  }

  const loginUrl = new URL("/login", request.url);
  if (token?.isBlocked) {
    loginUrl.searchParams.set("blocked", "1");
  }
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  const response = NextResponse.redirect(loginUrl);
  if (hasInvalidSessionCookie) clearNextAuthSessionCookies(response, cookieNames);
  return secureResponse(response, csp);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
