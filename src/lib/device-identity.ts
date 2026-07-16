import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const DEVICE_COOKIE_NAME = "audio_novel_br_device";
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

function readSecret() {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET ou AUTH_SECRET precisa estar configurado.");
  }
  return secret;
}

export function createDeviceToken(
  deviceId = randomBytes(32).toString("base64url"),
  secret = readSecret(),
) {
  const normalizedId = deviceId.trim();
  if (!normalizedId || normalizedId.length > 200) {
    throw new Error("Identificador de dispositivo invalido.");
  }

  const encodedId = Buffer.from(normalizedId, "utf8").toString("base64url");
  const body = `v1.${encodedId}`;
  const signature = createHmac("sha256", secret)
    .update(`audio-novel-device:${body}`)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function getDeviceIdFromToken(token: string | null | undefined, secret = readSecret()) {
  if (!token || token.length > 512) return null;
  const [version, encodedId, signature, extraPart] = token.split(".");
  if (version !== "v1" || !encodedId || !signature || extraPart) return null;

  const expected = createHmac("sha256", secret)
    .update(`audio-novel-device:${version}.${encodedId}`)
    .digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const deviceId = Buffer.from(encodedId, "base64url").toString("utf8").trim();
    return deviceId && deviceId.length <= 200 ? deviceId : null;
  } catch {
    return null;
  }
}

export function verifyDeviceToken(token: string | null | undefined, secret = readSecret()) {
  return getDeviceIdFromToken(token, secret) !== null;
}
