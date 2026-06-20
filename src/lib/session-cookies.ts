import type { NextResponse } from "next/server";

const SESSION_COOKIE_BASE_NAMES = ["next-auth.session-token", "__Secure-next-auth.session-token"] as const;

type CookieLike = {
  name: string;
  value: string;
};

export function isNextAuthSessionCookieName(name: string) {
  return SESSION_COOKIE_BASE_NAMES.some((baseName) => name === baseName || name.startsWith(`${baseName}.`));
}

export function hasNextAuthSessionCookie(cookieNames: Iterable<string>) {
  for (const name of cookieNames) {
    if (isNextAuthSessionCookieName(name)) return true;
  }

  return false;
}

export function getNextAuthSessionCookieNames(cookieNames: Iterable<string>) {
  return Array.from(new Set(Array.from(cookieNames).filter(isNextAuthSessionCookieName)));
}

export function getNextAuthSessionCookieValue(cookies: Iterable<CookieLike>) {
  const cookieList = Array.from(cookies);

  for (const baseName of SESSION_COOKIE_BASE_NAMES) {
    const chunks = cookieList
      .filter((cookie) => cookie.name === baseName || cookie.name.startsWith(`${baseName}.`))
      .sort((a, b) => {
        const aSuffix = Number.parseInt(a.name.split(".").pop() ?? "0", 10);
        const bSuffix = Number.parseInt(b.name.split(".").pop() ?? "0", 10);
        return aSuffix - bSuffix;
      });

    if (chunks.length) {
      return chunks.map((cookie) => cookie.value).join("");
    }
  }

  return null;
}

export function clearNextAuthSessionCookies(response: NextResponse, cookieNames: Iterable<string>) {
  for (const name of getNextAuthSessionCookieNames(cookieNames)) {
    response.cookies.set(name, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
    });
  }
}
