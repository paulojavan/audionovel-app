const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60_000;

export type OfflineAccessState =
  | "allowed"
  | "expired"
  | "clock-rollback"
  | "device-mismatch"
  | "invalid";

type OfflineLicensePayloadV1 = {
  version: 1;
  userId: string;
  sessionId: string;
  deviceId?: never;
  issuedAt: string;
  expiresAt: string;
};

type OfflineLicensePayloadV2 = {
  version: 2;
  userId: string;
  deviceId: string;
  sessionId?: never;
  issuedAt: string;
  expiresAt: string;
};

type OfflineLicensePayload = OfflineLicensePayloadV1 | OfflineLicensePayloadV2;

type VerifyOfflineLicenseForClientInput = {
  token: string;
  publicKey: string;
  userId: string;
  sessionId?: string;
  deviceId?: string;
  now?: number;
  lastObservedAt?: number | null;
};

export function getOfflineAccessState({
  issuedAt,
  expiresAt,
  now = Date.now(),
  lastObservedAt,
}: {
  issuedAt: number;
  expiresAt: number;
  now?: number;
  lastObservedAt?: number | null;
}): OfflineAccessState {
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt >= expiresAt
  ) {
    return "invalid";
  }
  if (now >= expiresAt) return "expired";
  if (now + CLOCK_ROLLBACK_TOLERANCE_MS < issuedAt) return "clock-rollback";
  if (
    typeof lastObservedAt === "number" &&
    Number.isFinite(lastObservedAt) &&
    now + CLOCK_ROLLBACK_TOLERANCE_MS < lastObservedAt
  ) {
    return "clock-rollback";
  }
  return "allowed";
}

export async function verifyOfflineLicenseForClient({
  token,
  publicKey,
  userId,
  sessionId,
  deviceId,
  now = Date.now(),
  lastObservedAt,
}: VerifyOfflineLicenseForClientInput): Promise<{
  state: OfflineAccessState;
  payload: OfflineLicensePayload | null;
}> {
  try {
    const [encodedPayload, encodedSignature, extraPart] = token.split(".");
    if (!encodedPayload || !encodedSignature || extraPart) {
      return { state: "invalid", payload: null };
    }

    const verificationKey = await globalThis.crypto.subtle.importKey(
      "spki",
      fromBase64Url(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const signatureValid = await globalThis.crypto.subtle.verify(
      { name: "Ed25519" },
      verificationKey,
      fromBase64Url(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    );
    if (!signatureValid) return { state: "invalid", payload: null };

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload)),
    ) as OfflineLicensePayload;
    if (
      (payload.version !== 1 && payload.version !== 2) ||
      payload.userId !== userId
    ) {
      return { state: "invalid", payload: null };
    }
    if (payload.version === 1 && (!sessionId || payload.sessionId !== sessionId)) {
      return { state: "invalid", payload: null };
    }
    if (payload.version === 2 && (!deviceId || payload.deviceId !== deviceId)) {
      return { state: "device-mismatch", payload };
    }

    const state = getOfflineAccessState({
      issuedAt: new Date(payload.issuedAt).getTime(),
      expiresAt: new Date(payload.expiresAt).getTime(),
      now,
      lastObservedAt,
    });
    return { state, payload };
  } catch {
    return { state: "invalid", payload: null };
  }
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
