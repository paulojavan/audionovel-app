import assert from "node:assert/strict";
import test from "node:test";
import { createSingleFlightGuard } from "./single-flight";

test("aceita somente a primeira tentativa enquanto estiver bloqueado", () => {
  const guard = createSingleFlightGuard();
  assert.equal(guard.tryAcquire(), true);
  assert.equal(guard.tryAcquire(), false);
  assert.equal(guard.isLocked(), true);
});

test("volta a aceitar depois da liberacao", () => {
  const guard = createSingleFlightGuard();
  guard.tryAcquire();
  guard.release();
  assert.equal(guard.isLocked(), false);
  assert.equal(guard.tryAcquire(), true);
});
