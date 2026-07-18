import assert from "node:assert/strict";
import test from "node:test";
import { createAsyncTtlCache } from "./async-ttl-cache";

test("coalesces concurrent loads for the same key", async () => {
  const cache = createAsyncTtlCache<string, string>({
    ttlMs: 30_000,
    maxEntries: 10,
  });
  let loads = 0;
  const load = async () => {
    loads += 1;
    await Promise.resolve();
    return "active";
  };

  assert.deepEqual(
    await Promise.all([
      cache.get("session-1", load),
      cache.get("session-1", load),
      cache.get("session-1", load),
    ]),
    ["active", "active", "active"],
  );
  assert.equal(loads, 1);
});

test("reuses successful results only until the TTL expires", async () => {
  let currentNow = 1_000;
  let loads = 0;
  const cache = createAsyncTtlCache<string, string>({
    ttlMs: 30_000,
    maxEntries: 10,
    now: () => currentNow,
  });
  const load = async () => `value-${++loads}`;

  assert.equal(await cache.get("session-1", load), "value-1");
  currentNow += 29_999;
  assert.equal(await cache.get("session-1", load), "value-1");
  currentNow += 1;
  assert.equal(await cache.get("session-1", load), "value-2");
  assert.equal(loads, 2);
});

test("coalesces rejected loads without caching the rejection", async () => {
  const cache = createAsyncTtlCache<string, string>({
    ttlMs: 30_000,
    maxEntries: 10,
  });
  const failure = new Error("database unavailable");
  let loads = 0;
  const fail = async () => {
    loads += 1;
    await Promise.resolve();
    throw failure;
  };

  const rejected = await Promise.allSettled([
    cache.get("session-1", fail),
    cache.get("session-1", fail),
  ]);

  assert.equal(loads, 1);
  assert.deepEqual(
    rejected.map((result) => result.status),
    ["rejected", "rejected"],
  );
  assert.equal(
    await cache.get("session-1", async () => {
      loads += 1;
      return "recovered";
    }),
    "recovered",
  );
  assert.equal(loads, 2);
});

test("evicts the least recently used successful result at the entry limit", async () => {
  const cache = createAsyncTtlCache<string, string>({
    ttlMs: 30_000,
    maxEntries: 2,
  });
  const loads = new Map<string, number>();
  const read = (key: string) =>
    cache.get(key, async () => {
      const count = (loads.get(key) ?? 0) + 1;
      loads.set(key, count);
      return `${key}-${count}`;
    });

  assert.equal(await read("a"), "a-1");
  assert.equal(await read("b"), "b-1");
  assert.equal(await read("a"), "a-1");
  assert.equal(await read("c"), "c-1");
  assert.equal(await read("b"), "b-2");
});
