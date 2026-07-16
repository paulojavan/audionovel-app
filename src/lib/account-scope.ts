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

type AccountScopeMessageTarget = {
  postMessage(message: unknown, transfer: Transferable[]): void;
};

type ConfirmAccountScopeOptions = {
  storage?: Pick<Storage, "setItem">;
  target?: AccountScopeMessageTarget | null;
  timeoutMs?: number;
};

export async function setBrowserAccountScopeConfirmed(
  scope: string | null | undefined,
  options: ConfirmAccountScopeOptions = {},
) {
  const normalizedScope = normalizeAccountScope(scope);
  const storage = options.storage ?? (
    typeof window === "undefined" ? undefined : window.localStorage
  );
  const target = options.target ?? (
    typeof navigator === "undefined" ? null : navigator.serviceWorker?.controller
  );

  try {
    storage?.setItem(ACCOUNT_SCOPE_STORAGE_KEY, normalizedScope);
  } catch {
    return false;
  }
  if (!target) return true;

  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      channel.port1.close();
      channel.port2.close();
      resolve(confirmed);
    };
    const timeoutId = setTimeout(
      () => finish(false),
      options.timeoutMs ?? 1_000,
    );

    channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean; scope?: string }>) => {
      finish(event.data?.ok === true && event.data.scope === normalizedScope);
    };
    try {
      target.postMessage(buildAccountScopeMessage(normalizedScope), [channel.port2]);
    } catch {
      finish(false);
    }
  });
}
