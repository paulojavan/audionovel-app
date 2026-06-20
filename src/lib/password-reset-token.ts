import { createHash, randomBytes } from "node:crypto";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60_000;

export function createPlainResetToken() {
  return randomBytes(RESET_TOKEN_BYTES).toString("base64url");
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function getPasswordResetExpiry(now = new Date()) {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MS);
}
