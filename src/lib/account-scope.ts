export const ANONYMOUS_ACCOUNT_SCOPE = "anonymous";
export const ACCOUNT_SCOPE_STORAGE_KEY = "audio-novel-br-account-scope";

export function normalizeAccountScope(value: string | null | undefined) {
  return value?.trim() || ANONYMOUS_ACCOUNT_SCOPE;
}

export function buildAccountStorageKey(scope: string | null | undefined, value: string) {
  return `account:${normalizeAccountScope(scope)}:${value}`;
}

export function buildAccountScopeMessage(scope: string | null | undefined) {
  return {
    type: "SET_ACCOUNT_SCOPE" as const,
    scope: normalizeAccountScope(scope),
  };
}

export function setBrowserAccountScope(scope: string | null | undefined) {
  if (typeof window === "undefined") return;

  const normalizedScope = normalizeAccountScope(scope);
  window.localStorage.setItem(ACCOUNT_SCOPE_STORAGE_KEY, normalizedScope);
  navigator.serviceWorker?.controller?.postMessage(buildAccountScopeMessage(normalizedScope));
}
