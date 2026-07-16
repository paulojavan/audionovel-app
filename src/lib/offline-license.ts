import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

const ADMIN_OFFLINE_LICENSE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ED25519_PKCS8_SEED_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export type OfflineLicensePayloadV1 = {
  version: 1;
  userId: string;
  sessionId: string;
  deviceId?: never;
  issuedAt: string;
  expiresAt: string;
};

export type OfflineLicensePayloadV2 = {
  version: 2;
  userId: string;
  deviceId: string;
  sessionId?: never;
  issuedAt: string;
  expiresAt: string;
};

export type OfflineLicensePayload = OfflineLicensePayloadV1 | OfflineLicensePayloadV2;

export type OfflineLicense = {
  token: string;
  publicKey: string;
  issuedAt: string;
  expiresAt: string;
};

type CreateOfflineLicenseInput = {
  userId: string;
  sessionId?: string;
  deviceId?: string;
  premiumUntil: Date | string | null;
  role?: string | null;
  now?: Date;
  secret?: string;
};

type VerifyOfflineLicenseInput = {
  userId: string;
  sessionId?: string;
  deviceId?: string;
  now?: Date;
  secret?: string;
};

export function getOfflineLicenseExpiry(
  premiumUntil: Date | string | null,
  now = new Date(),
  role?: string | null,
) {
  if (role === "ADMIN") {
    if (!premiumUntil) {
      return new Date(now.getTime() + ADMIN_OFFLINE_LICENSE_MAX_AGE_MS);
    }
  }

  if (!premiumUntil) throw new Error("Premium expirado.");
  const premiumExpiry = new Date(premiumUntil);
  if (
    Number.isNaN(premiumExpiry.getTime()) ||
    premiumExpiry.getTime() <= now.getTime()
  ) {
    throw new Error("Premium expirado.");
  }

  return premiumExpiry;
}

export function createOfflineLicense({
  userId,
  sessionId,
  deviceId,
  premiumUntil,
  role,
  now = new Date(),
  secret,
}: CreateOfflineLicenseInput): OfflineLicense {
  const expiresAt = getOfflineLicenseExpiry(premiumUntil, now, role);
  if (!deviceId && !sessionId) {
    throw new Error("Dispositivo offline ausente.");
  }
  const payload: OfflineLicensePayload = deviceId
    ? {
        version: 2,
        userId,
        deviceId,
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      }
    : {
        version: 1,
        userId,
        sessionId: sessionId as string,
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const privateKey = getPrivateKey(secret);
  const signature = sign(null, Buffer.from(encodedPayload), privateKey).toString("base64url");

  return {
    token: `${encodedPayload}.${signature}`,
    publicKey: exportPublicKey(privateKey),
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

export function verifyOfflineLicense(
  token: string,
  { userId, sessionId, deviceId, now = new Date(), secret }: VerifyOfflineLicenseInput,
) {
  const [encodedPayload, encodedSignature, extraPart] = token.split(".");
  if (!encodedPayload || !encodedSignature || extraPart) {
    throw new Error("Licenca offline invalida.");
  }

  const publicKey = createPublicKey(getPrivateKey(secret));
  const validSignature = verify(
    null,
    Buffer.from(encodedPayload),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!validSignature) throw new Error("Licenca offline invalida.");

  let payload: OfflineLicensePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as OfflineLicensePayload;
  } catch {
    throw new Error("Licenca offline invalida.");
  }

  const issuedAt = new Date(payload.issuedAt).getTime();
  const expiresAt = new Date(payload.expiresAt).getTime();
  if (
    (payload.version !== 1 && payload.version !== 2) ||
    payload.userId !== userId ||
    (payload.version === 1 && (!sessionId || payload.sessionId !== sessionId)) ||
    (payload.version === 2 && (!deviceId || payload.deviceId !== deviceId)) ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt >= expiresAt
  ) {
    throw new Error("Licenca offline invalida.");
  }
  if (expiresAt <= now.getTime()) throw new Error("Licenca offline expirada.");

  return payload;
}

function getPrivateKey(secret?: string) {
  const signingSecret = secret ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!signingSecret) {
    throw new Error("NEXTAUTH_SECRET ou AUTH_SECRET precisa estar configurado.");
  }

  const seed = createHash("sha256")
    .update("audio-novel-offline-license:v1:")
    .update(signingSecret)
    .digest();

  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_SEED_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
}

function exportPublicKey(privateKey: KeyObject) {
  return createPublicKey(privateKey)
    .export({ format: "der", type: "spki" })
    .toString("base64url");
}
