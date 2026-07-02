import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

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

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

type DistributedRateLimitRow = {
  count: number;
  resetAt: Date;
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

export function hashRateLimitKey(
  key: string,
  secret = getRateLimitSecret(),
) {
  return createHmac("sha256", secret).update(key).digest("hex");
}

function getRateLimitSecret() {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_SECRET ou NEXTAUTH_SECRET precisa estar configurado.");
  }
  return secret ?? "development-rate-limit";
}

export function nextRateLimitBucket(
  existing: { count: number; resetAt: number } | null,
  now: number,
  windowMs: number,
) {
  if (!existing || existing.resetAt <= now) {
    return { count: 1, resetAt: now + windowMs };
  }
  return { count: existing.count + 1, resetAt: existing.resetAt };
}

export function shouldCleanupRateLimitRows(hashedKey: string) {
  return Number.parseInt(hashedKey.slice(0, 2), 16) < 4;
}

export async function consumeRateLimit({ key, limit, windowMs }: EnforceRateLimitOptions) {
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);
  const hashedKey = hashRateLimitKey(key);

  try {
    const rows = await prisma.$queryRaw<DistributedRateLimitRow[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
      VALUES (${hashedKey}, 1, ${nextResetAt}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${nextResetAt}
          ELSE "RateLimitBucket"."resetAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count", "resetAt"
    `;
    const bucket = rows[0];
    if (shouldCleanupRateLimitRows(hashedKey)) {
      await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "resetAt" <= ${now}`.catch(() => undefined);
    }
    const retryAfterSec = bucket
      ? Math.max(1, Math.ceil((new Date(bucket.resetAt).getTime() - now.getTime()) / 1000))
      : Math.ceil(windowMs / 1000);
    return { allowed: Boolean(bucket && bucket.count <= limit), retryAfterSec };
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return checkRateLimit({ key: hashedKey, limit, windowMs });
  }
}

export async function enforceRateLimit({ key, limit, windowMs }: EnforceRateLimitOptions) {
  const result = await consumeRateLimit({ key, limit, windowMs });
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

  return getRequestIdentifierFromHeaders(request.headers);
}

export function getRequestIdentifierFromHeaders(headers: HeaderSource) {
  const realIp = getHeader(headers, "x-real-ip");
  const cloudflareIp = getHeader(headers, "cf-connecting-ip");
  const forwardedFor = getHeader(headers, "x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${realIp || cloudflareIp || forwardedFor || "unknown"}`;
}

function getHeader(headers: HeaderSource, name: string) {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name)?.trim() || null;

  const value = headers[name] ?? headers[name.toLowerCase()];
  return (Array.isArray(value) ? value[0] : value)?.trim() || null;
}
