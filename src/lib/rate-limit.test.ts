import assert from "node:assert/strict";
import test from "node:test";
import {
  checkRateLimit,
  consumeRateLimitWithLease,
  getRequestIdentifierFromHeaders,
  hashRateLimitKey,
  nextRateLimitBucket,
  shouldCleanupRateLimitRows,
} from "./rate-limit";

test("allows requests while under the limit", () => {
  const store = new Map();
  assert.equal(checkRateLimit({ key: "user-1", limit: 2, windowMs: 1000, now: 1000, store }).allowed, true);
  assert.equal(checkRateLimit({ key: "user-1", limit: 2, windowMs: 1000, now: 1100, store }).allowed, true);
});

test("blocks requests after the limit in the same window", () => {
  const store = new Map();
  checkRateLimit({ key: "user-1", limit: 2, windowMs: 1000, now: 1000, store });
  checkRateLimit({ key: "user-1", limit: 2, windowMs: 1000, now: 1100, store });
  const result = checkRateLimit({ key: "user-1", limit: 2, windowMs: 1000, now: 1200, store });

  assert.equal(result.allowed, false);
  assert.equal(result.retryAfterSec, 1);
});

test("resets after the window expires", () => {
  const store = new Map();
  checkRateLimit({ key: "user-1", limit: 1, windowMs: 1000, now: 1000, store });
  assert.equal(checkRateLimit({ key: "user-1", limit: 1, windowMs: 1000, now: 1999, store }).allowed, false);
  assert.equal(checkRateLimit({ key: "user-1", limit: 1, windowMs: 1000, now: 2001, store }).allowed, true);
});

test("hash de rate limit nao armazena identificador bruto", () => {
  const hashed = hashRateLimitKey("login:user@example.com", "test-secret");
  assert.notEqual(hashed, "login:user@example.com");
  assert.equal(hashed, hashRateLimitKey("login:user@example.com", "test-secret"));
  assert.equal(hashed.length, 64);
});

test("politica distribuida reinicia janelas expiradas", () => {
  assert.deepEqual(
    nextRateLimitBucket({ count: 8, resetAt: 10 }, 11, 60),
    { count: 1, resetAt: 71 },
  );
  assert.deepEqual(
    nextRateLimitBucket({ count: 2, resetAt: 20 }, 11, 60),
    { count: 3, resetAt: 20 },
  );
  assert.deepEqual(
    nextRateLimitBucket({ count: 2, resetAt: 20 }, 11, 60, 12),
    { count: 14, resetAt: 20 },
  );
});

test("limpeza oportunista e deterministica limita crescimento da tabela", () => {
  assert.equal(shouldCleanupRateLimitRows("00".padEnd(64, "a")), true);
  assert.equal(shouldCleanupRateLimitRows("ff".padEnd(64, "a")), false);
});

test("producao sem cabecalho confiavel nao compartilha um bucket IP global", () => {
  assert.equal(
    getRequestIdentifierFromHeaders(
      new Headers({ "x-real-ip": "203.0.113.10" }),
      { production: true, trustedHeader: "" },
    ),
    null,
  );
});

test("cabecalho configurado distingue os IPs encaminhados pelo proxy", () => {
  assert.equal(
    getRequestIdentifierFromHeaders(
      new Headers({ "x-real-ip": "203.0.113.10" }),
      { production: true, trustedHeader: "x-real-ip" },
    ),
    "ip:203.0.113.10",
  );
  assert.equal(
    getRequestIdentifierFromHeaders(
      new Headers({ "x-real-ip": "203.0.113.11" }),
      { production: true, trustedHeader: "x-real-ip" },
    ),
    "ip:203.0.113.11",
  );
});

test("lease distribuido reserva um lote e atende ranges seguintes em memoria", async () => {
  const store = new Map<string, { remaining: number; resetAt: number }>();
  const reservations: number[] = [];
  const reserve = async ({ cost = 1 }: { cost?: number }) => {
    reservations.push(cost);
    return { allowed: true, retryAfterSec: 60 };
  };

  for (let request = 0; request < 13; request += 1) {
    const result = await consumeRateLimitWithLease({
      key: "audio:chapter:user",
      limit: 240,
      windowMs: 60_000,
      leaseSize: 12,
      now: 1_000,
      store,
      reserve,
    });
    assert.equal(result.allowed, true);
  }

  assert.deepEqual(reservations, [12, 12]);
});
