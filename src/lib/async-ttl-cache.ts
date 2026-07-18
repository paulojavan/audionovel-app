type CacheEntry<Value> =
  | { state: "pending"; promise: Promise<Value> }
  | { state: "ready"; value: Value; expiresAt: number };

export function createAsyncTtlCache<Key, Value>({
  ttlMs,
  maxEntries,
  now = Date.now,
}: {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}) {
  const entries = new Map<Key, CacheEntry<Value>>();

  const trim = () => {
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value as Key | undefined;
      if (oldestKey === undefined) return;
      entries.delete(oldestKey);
    }
  };

  return {
    async get(key: Key, load: () => Promise<Value>): Promise<Value> {
      const existing = entries.get(key);
      if (existing?.state === "pending") return existing.promise;
      if (existing?.state === "ready" && existing.expiresAt > now()) {
        entries.delete(key);
        entries.set(key, existing);
        return existing.value;
      }
      entries.delete(key);

      const pending: CacheEntry<Value> = {
        state: "pending",
        promise: load(),
      };
      entries.set(key, pending);
      trim();

      try {
        const value = await pending.promise;
        if (entries.get(key) === pending) {
          entries.set(key, {
            state: "ready",
            value,
            expiresAt: now() + ttlMs,
          });
        }
        return value;
      } catch (error) {
        if (entries.get(key) === pending) entries.delete(key);
        throw error;
      }
    },
  };
}
