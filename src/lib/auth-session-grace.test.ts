import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_DATABASE_GRACE_MS,
  evaluateSessionDatabaseGrace,
  getPrismaErrorCode,
  isTransientPrismaSessionError,
} from "./auth-session-grace";

test("classifies exactly the known transient Prisma session failures", () => {
  for (const code of ["P1001", "P1002", "P1008", "P1017", "P2024", "P2037"]) {
    assert.equal(isTransientPrismaSessionError({ code }), true, code);
  }

  assert.equal(isTransientPrismaSessionError({ code: "P2002" }), false);
  assert.equal(isTransientPrismaSessionError(new Error("socket closed")), false);
  assert.equal(isTransientPrismaSessionError(null), false);
  assert.equal(getPrismaErrorCode({ code: "P2024" }), "P2024");
  assert.equal(getPrismaErrorCode({ code: 2024 }), null);
  assert.equal(getPrismaErrorCode(null), null);
});

test("allows a validated session until one millisecond before the grace boundary", () => {
  const now = Date.parse("2026-07-05T10:00:00Z");

  assert.deepEqual(
    evaluateSessionDatabaseGrace({
      now,
      lastValidatedAt: now - SESSION_DATABASE_GRACE_MS + 1,
      sessionInvalid: false,
    }),
    { allowed: true, remainingMs: 1 },
  );
});

test("denies grace without a finite validation timestamp", () => {
  const now = Date.parse("2026-07-05T10:00:00Z");

  for (const lastValidatedAt of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(
      evaluateSessionDatabaseGrace({ now, lastValidatedAt, sessionInvalid: false }),
      { allowed: false, remainingMs: 0 },
    );
  }
});

test("denies grace for an invalid session", () => {
  const now = Date.parse("2026-07-05T10:00:00Z");

  assert.deepEqual(
    evaluateSessionDatabaseGrace({ now, lastValidatedAt: now, sessionInvalid: true }),
    { allowed: false, remainingMs: 0 },
  );
});

test("denies grace at exactly five minutes and clamps remaining time to zero", () => {
  const now = Date.parse("2026-07-05T10:00:00Z");

  assert.deepEqual(
    evaluateSessionDatabaseGrace({
      now,
      lastValidatedAt: now - SESSION_DATABASE_GRACE_MS,
      sessionInvalid: false,
    }),
    { allowed: false, remainingMs: 0 },
  );
});
