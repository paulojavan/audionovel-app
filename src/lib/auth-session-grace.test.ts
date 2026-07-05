import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_DATABASE_GRACE_MS,
  evaluateSessionDatabaseGrace,
  getPrismaErrorCode,
  isTransientPrismaSessionError,
  logSessionDatabaseFailure,
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

test("denies grace when the current timestamp is not finite", () => {
  for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.deepEqual(
      evaluateSessionDatabaseGrace({ now, lastValidatedAt: 1, sessionInvalid: false }),
      { allowed: false, remainingMs: 0 },
    );
  }
});

test("denies grace when the validation timestamp is in the future", () => {
  const now = Date.parse("2026-07-05T10:00:00Z");

  assert.deepEqual(
    evaluateSessionDatabaseGrace({
      now,
      lastValidatedAt: now + 1,
      sessionInvalid: false,
    }),
    { allowed: false, remainingMs: 0 },
  );
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

test("logs only sanitized structured session database failure fields", () => {
  const lines: string[] = [];
  const now = Date.parse("2026-07-05T10:00:00Z");
  const error = {
    code: "P2024",
    message:
      "Timed out connecting to postgresql://admin:secret@db.example.com/app",
    meta: {
      query: 'SELECT * FROM "User" WHERE id = \'user-123\'',
      email: "reader@example.com",
      sessionToken: "session-secret",
    },
  };

  logSessionDatabaseFailure({
    error,
    operation: "device_session_validation",
    graceApplied: true,
    remainingMs: 42_000,
    now,
    write: (line) => lines.push(line),
  });

  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    event: "auth_database_failure",
    timestamp: "2026-07-05T10:00:00.000Z",
    operation: "device_session_validation",
    prismaCode: "P2024",
    graceApplied: true,
    remainingGraceMs: 42_000,
  });

  for (const secret of [
    "postgresql://",
    "admin:secret",
    "SELECT",
    "user-123",
    "reader@example.com",
    "session-secret",
  ]) {
    assert.equal(lines[0].includes(secret), false, secret);
  }
});

test("logs invalid remaining grace metrics as zero", () => {
  for (const remainingMs of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
  ]) {
    const lines: string[] = [];

    logSessionDatabaseFailure({
      error: new Error("database unavailable"),
      operation: "user_state_refresh",
      graceApplied: false,
      remainingMs,
      now: Date.parse("2026-07-05T10:00:00Z"),
      write: (line) => lines.push(line),
    });

    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).remainingGraceMs, 0);
    assert.equal(lines[0].includes('"remainingGraceMs":null'), false);
  }
});
