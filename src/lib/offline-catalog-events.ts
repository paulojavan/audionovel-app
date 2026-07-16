import { normalizeAccountScope } from "./account-scope";

type OfflineCatalogListener = () => void;

const listenersByAccount = new Map<string, Set<OfflineCatalogListener>>();

export function subscribeOfflineCatalogUpdates(
  accountScope: string,
  listener: OfflineCatalogListener,
) {
  const scope = normalizeAccountScope(accountScope);
  const listeners = listenersByAccount.get(scope) ?? new Set();
  listeners.add(listener);
  listenersByAccount.set(scope, listeners);

  return () => {
    listeners.delete(listener);
    if (!listeners.size) listenersByAccount.delete(scope);
  };
}

export function notifyOfflineCatalogUpdated(accountScope: string) {
  const scope = normalizeAccountScope(accountScope);
  for (const listener of listenersByAccount.get(scope) ?? []) listener();
}
