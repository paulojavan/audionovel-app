import { normalizeAccountScope } from "./account-scope";

type CatalogReadiness = {
  ready: boolean;
  promise: Promise<void>;
  resolve: () => void;
};

const readinessByAccount = new Map<string, CatalogReadiness>();

function getReadiness(accountScope: string) {
  const scope = normalizeAccountScope(accountScope);
  const existing = readinessByAccount.get(scope);
  if (existing) return existing;

  let resolve!: () => void;
  const readiness: CatalogReadiness = {
    ready: false,
    promise: new Promise<void>((nextResolve) => {
      resolve = nextResolve;
    }),
    resolve: () => resolve(),
  };
  readinessByAccount.set(scope, readiness);
  return readiness;
}

export function markOfflineCatalogReady(accountScope: string) {
  const readiness = getReadiness(accountScope);
  if (readiness.ready) return;
  readiness.ready = true;
  readiness.resolve();
}

export async function waitForOfflineCatalogReady(
  accountScope: string,
  timeoutMs = 3_000,
) {
  const readiness = getReadiness(accountScope);
  if (readiness.ready) return;

  await Promise.race([
    readiness.promise,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
