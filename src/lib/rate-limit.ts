import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
  store?: Map<string, Bucket>;
};

type EnforceRateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const memoryStore = new Map<string, Bucket>();

export function checkRateLimit({ key, limit, windowMs, now = Date.now(), store = memoryStore }: RateLimitOptions) {
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  store.set(key, existing);
  return { allowed: true, retryAfterSec: 0 };
}

export function enforceRateLimit({ key, limit, windowMs }: EnforceRateLimitOptions) {
  const result = checkRateLimit({ key, limit, windowMs });
  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde um pouco e tente novamente." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    },
  );
}

export function getRequestIdentifier(request: Request, userId?: string) {
  if (userId) return `user:${userId}`;

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `ip:${forwardedFor || realIp || "unknown"}`;
}
