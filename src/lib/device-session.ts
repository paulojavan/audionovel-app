import { createHash, randomBytes } from "node:crypto";
import { hasSuspiciousUserAgentChange, selectDeviceToReplace } from "./device-session-policy";
import { prisma } from "./prisma";

const MAX_ACTIVE_DEVICES = 3;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

type HeaderLike = Record<string, string | string[] | undefined>;

type CreateDeviceSessionOptions = {
  userId: string;
  deviceId: string;
  deviceName?: string;
  headers?: HeaderLike;
};

type StoredSession = {
  id: string;
  userId: string;
  deviceIdHash: string;
  userAgentHash: string | null;
  revokedAt: Date | string | null;
  expiresAt: Date | string;
  lastSeenAt: Date | string;
  createdAt: Date | string;
};

export function createRandomSessionId() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getHeaderValue(headers: HeaderLike | undefined, name: string) {
  const lowerName = name.toLowerCase();
  const value = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === lowerName)?.[1];
  return Array.isArray(value) ? value[0] : value;
}

export function getIpPrefixFromHeaders(headers: HeaderLike | undefined) {
  const ip = (getHeaderValue(headers, "x-forwarded-for") ?? getHeaderValue(headers, "x-real-ip") ?? "")
    .split(",")[0]
    .trim();
  const parts = ip.split(".");

  if (parts.length >= 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }

  return ip || null;
}

export function shouldRefreshSessionLastSeen(lastSeenAt: Date | string, now = new Date(), refreshMs = LAST_SEEN_REFRESH_MS) {
  return now.getTime() - new Date(lastSeenAt).getTime() >= refreshMs;
}

export async function createDeviceSession({ userId, deviceId, deviceName, headers }: CreateDeviceSessionOptions) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const sessionId = createRandomSessionId();
  const deviceIdHash = hashSessionValue(deviceId);
  const userAgentHash = hashSessionValue(getHeaderValue(headers, "user-agent") ?? "unknown");
  const ipPrefix = getIpPrefixFromHeaders(headers);
  const ipPrefixHash = ipPrefix ? hashSessionValue(ipPrefix) : null;
  const replacedDeviceHash = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
    `;
    const activeSessions = await transaction.$queryRaw<Array<StoredSession>>`
      SELECT "id", "userId", "deviceIdHash", "userAgentHash", "revokedAt", "expiresAt", "lastSeenAt", "createdAt"
      FROM "UserSession"
      WHERE "userId" = ${userId} AND "revokedAt" IS NULL AND "expiresAt" > ${now}
    `;
    const replacement = selectDeviceToReplace(
      activeSessions,
      deviceIdHash,
      MAX_ACTIVE_DEVICES,
    );
    const currentDeviceAlreadyActive = activeSessions.some(
      (session) => session.deviceIdHash === deviceIdHash,
    );
    const deviceHashToRevoke = currentDeviceAlreadyActive
      ? deviceIdHash
      : replacement;

    if (deviceHashToRevoke) {
      await transaction.$executeRaw`
        UPDATE "UserSession" SET "revokedAt" = ${now}
        WHERE "userId" = ${userId} AND "deviceIdHash" = ${deviceHashToRevoke} AND "revokedAt" IS NULL
      `;
    }

    await transaction.$executeRaw`
      INSERT INTO "UserSession" ("id", "userId", "deviceIdHash", "deviceName", "userAgentHash", "ipPrefixHash", "revokedAt", "expiresAt", "lastSeenAt", "createdAt")
      VALUES (${sessionId}, ${userId}, ${deviceIdHash}, ${deviceName ?? null}, ${userAgentHash}, ${ipPrefixHash}, NULL, ${expiresAt}, ${now}, ${now})
    `;

    if (replacement) {
      await transaction.$executeRaw`
        INSERT INTO "SecurityEvent" ("id", "userId", "type", "severity", "message", "metadata", "readAt", "createdAt")
        VALUES (${createRandomSessionId()}, ${userId}, 'DEVICE_REPLACED', 'MEDIUM', 'Dispositivo menos recente substituido automaticamente durante o login.', ${JSON.stringify({ replacedDeviceHash: replacement })}, NULL, ${now})
      `;
    }

    return replacement;
  });

  return { allowed: true as const, sessionId, expiresAt, replacedDeviceHash };
}

export async function validateDeviceSession(sessionId: string | null | undefined, headers?: HeaderLike) {
  if (!sessionId) return { valid: false as const, reason: "MISSING_SESSION" as const };

  const now = new Date();
  const session = await getSessionById(sessionId);
  if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= now.getTime()) {
    return { valid: false as const, reason: "SESSION_REVOKED" as const };
  }

  const currentUserAgent = getHeaderValue(headers, "user-agent");
  const currentUserAgentHash = currentUserAgent ? hashSessionValue(currentUserAgent) : null;
  if (currentUserAgentHash && hasSuspiciousUserAgentChange(session.userAgentHash, currentUserAgentHash)) {
    await revokeAllUserSessions(session.userId);
    await createSecurityEvent({
      userId: session.userId,
      type: "USER_AGENT_CHANGED",
      message: "Mudanca suspeita de navegador/dispositivo detectada. Todas as sessoes foram encerradas.",
      metadata: { sessionId },
    });
    return { valid: false as const, reason: "SUSPICIOUS_USER_AGENT" as const };
  }

  if (shouldRefreshSessionLastSeen(session.lastSeenAt, now)) {
    await prisma.$executeRaw`UPDATE "UserSession" SET "lastSeenAt" = ${now} WHERE "id" = ${sessionId}`;
  }
  return { valid: true as const, userId: session.userId, sessionId };
}

export async function revokeDeviceSession(sessionId: string | null | undefined) {
  if (!sessionId) return;

  await prisma.$executeRaw`UPDATE "UserSession" SET "revokedAt" = ${new Date()} WHERE "id" = ${sessionId} AND "revokedAt" IS NULL`;
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.$executeRaw`UPDATE "UserSession" SET "revokedAt" = ${new Date()} WHERE "userId" = ${userId} AND "revokedAt" IS NULL`;
}

export async function getUnreadSecurityEventCount() {
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*) as "count" FROM "SecurityEvent" WHERE "readAt" IS NULL
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function getRecentSecurityEvents(limit = 50) {
  return prisma.$queryRaw<Array<{ id: string; userId: string; type: string; severity: string; message: string; createdAt: Date; userName: string | null; userEmail: string | null }>>`
    SELECT "SecurityEvent"."id", "SecurityEvent"."userId", "SecurityEvent"."type", "SecurityEvent"."severity", "SecurityEvent"."message", "SecurityEvent"."createdAt",
           "User"."name" as "userName", "User"."email" as "userEmail"
    FROM "SecurityEvent"
    LEFT JOIN "User" ON "User"."id" = "SecurityEvent"."userId"
    ORDER BY "SecurityEvent"."createdAt" DESC
    LIMIT ${limit}
  `;
}

async function getSessionById(sessionId: string) {
  const rows = await prisma.$queryRaw<Array<StoredSession>>`
    SELECT "id", "userId", "deviceIdHash", "userAgentHash", "revokedAt", "expiresAt", "lastSeenAt", "createdAt"
    FROM "UserSession"
    WHERE "id" = ${sessionId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function createSecurityEvent({ userId, type, message, metadata }: { userId: string; type: string; message: string; metadata: Record<string, unknown> }) {
  await prisma.$executeRaw`
    INSERT INTO "SecurityEvent" ("id", "userId", "type", "severity", "message", "metadata", "readAt", "createdAt")
    VALUES (${createRandomSessionId()}, ${userId}, ${type}, 'HIGH', ${message}, ${JSON.stringify(metadata)}, NULL, ${new Date()})
  `;
}
