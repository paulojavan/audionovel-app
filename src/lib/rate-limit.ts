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
  cost?: number;
  now?: number;
  store?: Map<string, Bucket>;
};

export type EnforceRateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  cost?: number;
};

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

type RequestIdentifierOptions = {
  production?: boolean;
  trustedHeader?: string | null;
};

type DistributedRateLimitRow = {
  count: number;
  resetAt: Date;
};

type RateLimitLease = {
  remaining: number;
  resetAt: number;
};

type ConsumeRateLimitLeaseOptions = Omit<EnforceRateLimitOptions, "cost"> & {
  leaseSize?: number;
  now?: number;
  store?: Map<string, RateLimitLease>;
  reserve?: (options: EnforceRateLimitOptions) => Promise<{ allowed: boolean; retryAfterSec: number }>;
};

const memoryStore = new Map<string, Bucket>();
const leaseStore = new Map<string, RateLimitLease>();
const MAX_RATE_LIMIT_LEASES = 4_096;

export function checkRateLimit({
  key,
  limit,
  windowMs,
  cost = 1,
  now = Date.now(),
  store = memoryStore,
}: RateLimitOptions) {
  const normalizedCost = normalizeRateLimitCost(cost, limit);
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: normalizedCost, resetAt: now + windowMs });
    return {
      allowed: normalizedCost <= limit,
      retryAfterSec: normalizedCost <= limit ? 0 : Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  if (existing.count + normalizedCost > limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += normalizedCost;
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
  cost = 1,
) {
  const normalizedCost = Math.max(1, Math.floor(cost));
  if (!existing || existing.resetAt <= now) {
    return { count: normalizedCost, resetAt: now + windowMs };
  }
  return { count: existing.count + normalizedCost, resetAt: existing.resetAt };
}

export function shouldCleanupRateLimitRows(hashedKey: string) {
  return Number.parseInt(hashedKey.slice(0, 2), 16) < 4;
}

export async function consumeRateLimit({ key, limit, windowMs, cost = 1 }: EnforceRateLimitOptions) {
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);
  const hashedKey = hashRateLimitKey(key);
  const normalizedCost = normalizeRateLimitCost(cost, limit);

  try {
    const rows = await prisma.$queryRaw<DistributedRateLimitRow[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
      VALUES (${hashedKey}, ${normalizedCost}, ${nextResetAt}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${normalizedCost}
          ELSE "RateLimitBucket"."count" + ${normalizedCost}
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
    return checkRateLimit({ key: hashedKey, limit, windowMs, cost: normalizedCost });
  }
}

export async function consumeRateLimitWithLease({
  key,
  limit,
  windowMs,
  leaseSize = 12,
  now = Date.now(),
  store = leaseStore,
  reserve = consumeRateLimit,
}: ConsumeRateLimitLeaseOptions) {
  const leaseKey = `${key}:${limit}:${windowMs}`;
  const existing = store.get(leaseKey);

  if (existing && existing.resetAt > now && existing.remaining > 0) {
    existing.remaining -= 1;
    store.set(leaseKey, existing);
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing) store.delete(leaseKey);

  const reservationSize = normalizeRateLimitCost(leaseSize, limit);
  const result = await reserve({
    key,
    limit,
    windowMs,
    cost: reservationSize,
  });
  if (!result.allowed) return result;

  store.set(leaseKey, {
    remaining: reservationSize - 1,
    resetAt: now + Math.max(1, result.retryAfterSec) * 1000,
  });
  cleanupExpiredLeases(store, now);
  return { allowed: true, retryAfterSec: 0 };
}

export async function enforceRateLimit({ key, limit, windowMs, cost }: EnforceRateLimitOptions) {
  const result = await consumeRateLimit({ key, limit, windowMs, cost });
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

export function getRequestIdentifierFromHeaders(
  headers: HeaderSource,
  options: RequestIdentifierOptions = {},
) {
  const trustedHeader = (options.trustedHeader ?? process.env.TRUSTED_PROXY_IP_HEADER)
    ?.trim()
    .toLowerCase();
  const production = options.production ?? process.env.NODE_ENV === "production";
  if (trustedHeader && ["x-real-ip", "cf-connecting-ip", "x-forwarded-for"].includes(trustedHeader)) {
    const trustedValue = getHeader(headers, trustedHeader);
    const ip = trustedHeader === "x-forwarded-for" ? trustedValue?.split(",")[0]?.trim() : trustedValue;
    return ip ? `ip:${ip}` : null;
  }

  if (production) return null;

  const realIp = getHeader(headers, "x-real-ip");
  const cloudflareIp = getHeader(headers, "cf-connecting-ip");
  const forwardedFor = getHeader(headers, "x-forwarded-for")?.split(",")[0]?.trim();
  const ip = realIp || cloudflareIp || forwardedFor;
  return ip ? `ip:${ip}` : null;
}

function normalizeRateLimitCost(cost: number, limit: number) {
  return Math.max(1, Math.min(limit, Math.floor(cost)));
}

function cleanupExpiredLeases(store: Map<string, RateLimitLease>, now: number) {
  if (store.size < MAX_RATE_LIMIT_LEASES) return;
  for (const [key, lease] of store) {
    if (lease.resetAt <= now) store.delete(key);
  }
  while (store.size > MAX_RATE_LIMIT_LEASES) {
    const oldestKey = store.keys().next().value;
    if (typeof oldestKey !== "string") break;
    store.delete(oldestKey);
  }
}

function getHeader(headers: HeaderSource, name: string) {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name)?.trim() || null;

  const value = headers[name] ?? headers[name.toLowerCase()];
  return (Array.isArray(value) ? value[0] : value)?.trim() || null;
}
