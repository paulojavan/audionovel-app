type PublicOriginInput = {
  headers: Headers;
  envOrigin?: string | null;
  fallbackOrigin?: string | null;
};

export function getPublicOrigin({ headers, envOrigin, fallbackOrigin }: PublicOriginInput) {
  const forwardedOrigin = getForwardedOrigin(headers);
  if (forwardedOrigin && !isLocalOrigin(forwardedOrigin)) return forwardedOrigin;

  const normalizedEnvOrigin = normalizeOrigin(envOrigin);
  if (normalizedEnvOrigin && !isLocalOrigin(normalizedEnvOrigin)) return normalizedEnvOrigin;

  if (forwardedOrigin) return forwardedOrigin;

  const normalizedFallback = normalizeOrigin(fallbackOrigin);
  return normalizedFallback ?? "http://localhost:3000";
}

function getForwardedOrigin(headers: Headers) {
  const host = getForwardedHeaderValue(headers, "x-forwarded-host") ?? getForwardedHeaderValue(headers, "host");
  if (!host) return null;

  const proto = getForwardedHeaderValue(headers, "x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return normalizeOrigin(`${proto}://${host}`);
}

function getForwardedHeaderValue(headers: Headers, key: string) {
  return headers.get(key)?.split(",")[0]?.trim() || null;
}

function normalizeOrigin(origin: string | null | undefined) {
  if (!origin) return null;
  try {
    const url = new URL(origin.trim().replace(/\/+$/, ""));
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}
