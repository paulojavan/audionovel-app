type SessionTokenLike = {
  id?: unknown;
  isBlocked?: unknown;
  sessionInvalid?: unknown;
} | null | undefined;

export function isDecodedSessionTokenUsable(token: SessionTokenLike) {
  return Boolean(token && typeof token.id === "string" && token.id && token.isBlocked !== true && token.sessionInvalid !== true);
}
