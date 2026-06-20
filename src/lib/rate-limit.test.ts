import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit } from "./rate-limit";

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
