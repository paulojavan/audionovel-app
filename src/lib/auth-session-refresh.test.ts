import assert from "node:assert/strict";
import test from "node:test";
import { SESSION_DATABASE_GRACE_MS } from "./auth-session-grace";
import { refreshEstablishedSession } from "./auth-session-refresh";

const VALIDATION_INTERVAL_MS = 30_000;

function createToken(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    sessionId: "session-1",
    sessionInvalid: false,
    sessionCheckedAt: 1,
    sessionValidatedAt: 1,
    email: "old@example.com",
    isBlocked: false,
    name: "Old name",
    plan: "FREE",
    role: "USER",
    subscriptionStatus: "INACTIVE",
    premiumUntil: null,
    ...overrides,
  };
}

function createUserState(overrides: Record<string, unknown> = {}) {
  return {
    email: "fresh@example.com",
    isBlocked: false,
    name: "Fresh name",
    plan: "PREMIUM",
    role: "USER",
    subscriptionStatus: "ACTIVE",
    premiumUntil: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createHarness({
  token = createToken(),
  currentNow = 120_000,
  validateDeviceSession = async () => ({ valid: true }),
  findUserState = async () => createUserState(),
}: {
  token?: ReturnType<typeof createToken>;
  currentNow?: number;
  validateDeviceSession?: (sessionId: string) => Promise<{ valid: boolean }>;
  findUserState?: (userId: string) => Promise<ReturnType<typeof createUserState> | null>;
} = {}) {
  const failures: Array<{
    operation: "device_session_validation" | "user_state_refresh";
    graceApplied: boolean;
    remainingMs: number;
  }> = [];

  return {
    token,
    failures,
    run: () =>
      refreshEstablishedSession({
        token,
        validationIntervalMs: VALIDATION_INTERVAL_MS,
        now: () => currentNow,
        validateDeviceSession,
        findUserState,
        logDatabaseFailure: ({ operation, graceApplied, remainingMs }) =>
          failures.push({ operation, graceApplied, remainingMs }),
      }),
  };
}

test("updates the shared validation anchor only after device and user state both succeed", async () => {
  const harness = createHarness();

  await harness.run();

  assert.equal(harness.token.sessionCheckedAt, 120_000);
  assert.equal(harness.token.sessionValidatedAt, 120_000);
  assert.equal(harness.token.email, "fresh@example.com");
  assert.equal(harness.token.plan, "PREMIUM");
});

test("graces a transient device failure without advancing the anchor or reading user state", async () => {
  const anchor = 100_000;
  let userLookups = 0;
  const harness = createHarness({
    token: createToken({ sessionCheckedAt: anchor, sessionValidatedAt: anchor }),
    currentNow: anchor + 60_000,
    validateDeviceSession: async () => {
      throw { code: "P1001" };
    },
    findUserState: async () => {
      userLookups += 1;
      return createUserState();
    },
  });

  await harness.run();

  assert.equal(harness.token.sessionCheckedAt, anchor + 60_000);
  assert.equal(harness.token.sessionValidatedAt, anchor);
  assert.equal(userLookups, 0);
  assert.deepEqual(harness.failures, [
    {
      operation: "device_session_validation",
      graceApplied: true,
      remainingMs: SESSION_DATABASE_GRACE_MS - 60_000,
    },
  ]);
});

test("repeated transient user refresh failures preserve the old anchor and fail at five minutes", async () => {
  const anchor = 100_000;
  const token = createToken({ sessionCheckedAt: anchor, sessionValidatedAt: anchor });
  const transient = { code: "P2024" };

  await createHarness({
    token,
    currentNow: anchor + SESSION_DATABASE_GRACE_MS - 1,
    findUserState: async () => {
      throw transient;
    },
  }).run();

  assert.equal(token.sessionValidatedAt, anchor);

  const expiredHarness = createHarness({
    token,
    currentNow: anchor + SESSION_DATABASE_GRACE_MS,
    findUserState: async () => {
      throw transient;
    },
  });

  await assert.rejects(expiredHarness.run, (error) => error === transient);
  assert.equal(token.sessionValidatedAt, anchor);
  assert.equal(expiredHarness.failures.at(-1)?.graceApplied, false);
});

test("explicitly invalid device sessions clear identity immediately and skip user state", async () => {
  let userLookups = 0;
  const harness = createHarness({
    validateDeviceSession: async () => ({ valid: false }),
    findUserState: async () => {
      userLookups += 1;
      return createUserState();
    },
  });

  await harness.run();

  assert.equal(harness.token.sessionInvalid, true);
  assert.equal(harness.token.id, undefined);
  assert.equal(userLookups, 0);
  assert.equal(harness.failures.length, 0);
});

test("logs and rethrows nontransient database failures without grace", async () => {
  const failure = { code: "P2002" };
  const harness = createHarness({
    validateDeviceSession: async () => {
      throw failure;
    },
  });

  await assert.rejects(harness.run, (error) => error === failure);
  assert.deepEqual(harness.failures, [
    {
      operation: "device_session_validation",
      graceApplied: false,
      remainingMs: 0,
    },
  ]);
});

test("applies a successfully refreshed blocked user immediately", async () => {
  const harness = createHarness({
    findUserState: async () => createUserState({ isBlocked: true }),
  });

  await harness.run();

  assert.equal(harness.token.isBlocked, true);
  assert.equal(harness.token.sessionValidatedAt, 120_000);
});

test("uses legacy checkedAt once as the fixed trusted anchor", async () => {
  const anchor = 100_000;
  const token = createToken({ sessionCheckedAt: anchor, sessionValidatedAt: undefined });
  const transient = { code: "P1002" };

  await createHarness({
    token,
    currentNow: anchor + 60_000,
    validateDeviceSession: async () => {
      throw transient;
    },
  }).run();

  assert.equal(token.sessionValidatedAt, anchor);
  assert.equal(token.sessionCheckedAt, anchor + 60_000);

  const expiredHarness = createHarness({
    token,
    currentNow: anchor + SESSION_DATABASE_GRACE_MS,
    validateDeviceSession: async () => {
      throw transient;
    },
  });

  await assert.rejects(expiredHarness.run, (error) => error === transient);
  assert.equal(token.sessionValidatedAt, anchor);
});
