import assert from "node:assert/strict";
import test from "node:test";
import { hasActiveSessionUser } from "./session-state";

test("hasActiveSessionUser rejects missing or revoked session state", () => {
  assert.equal(hasActiveSessionUser(null), false);
  assert.equal(hasActiveSessionUser({ user: null }), false);
  assert.equal(hasActiveSessionUser({ user: { id: "user-1", sessionId: null } }), false);
  assert.equal(hasActiveSessionUser({ user: { id: "user-1", sessionId: "session-1", sessionInvalid: true } }), false);
  assert.equal(hasActiveSessionUser({ user: { id: "user-1", sessionId: "session-1", isBlocked: true } }), false);
});

test("hasActiveSessionUser accepts active session state carried by the jwt", () => {
  assert.equal(hasActiveSessionUser({ user: { id: "user-1", sessionId: "session-1", sessionInvalid: false, isBlocked: false } }), true);
});
