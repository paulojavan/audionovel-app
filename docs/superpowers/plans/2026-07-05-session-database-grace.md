# Session Database Grace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve an already validated JWT session for at most five minutes during recognized transient Prisma failures without weakening explicit revocation, blocking, or new-login checks.

**Architecture:** Add a pure policy module that classifies a narrow Prisma error-code allowlist, calculates bounded grace, and emits sanitized structured diagnostics. Wire it into the NextAuth JWT callback around device validation and user-state refresh while recording the last successful validation in the JWT.

**Tech Stack:** Next.js 16.2.9, NextAuth 4 JWT sessions, Prisma 6.19, TypeScript, Node test runner through `tsx`.

---

## File structure

- Create `src/lib/auth-session-grace.ts`: transient-error classification, five-minute policy, and sanitized logging.
- Create `src/lib/auth-session-grace.test.ts`: unit coverage for classification, timing, and log safety.
- Create `src/lib/auth-session-grace-wiring.test.ts`: source-level regression checks for both JWT database boundaries.
- Modify `src/types/next-auth.d.ts`: persist `sessionValidatedAt` in the JWT type.
- Modify `src/lib/auth.ts`: apply grace only to established sessions and refresh the timestamp only after successful validation.

### Task 1: Pure grace policy

**Files:**
- Create: `src/lib/auth-session-grace.ts`
- Test: `src/lib/auth-session-grace.test.ts`

- [ ] **Step 1: Write the failing policy tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_DATABASE_GRACE_MS,
  evaluateSessionDatabaseGrace,
  getPrismaErrorCode,
  isTransientPrismaSessionError,
} from "./auth-session-grace";

test("classifica somente falhas transitorias conhecidas", () => {
  for (const code of ["P1001", "P1002", "P1008", "P1017", "P2024", "P2037"]) {
    assert.equal(isTransientPrismaSessionError({ code }), true, code);
  }
  assert.equal(isTransientPrismaSessionError({ code: "P2002" }), false);
  assert.equal(isTransientPrismaSessionError(new Error("socket closed")), false);
  assert.equal(getPrismaErrorCode({ code: "P2024" }), "P2024");
  assert.equal(getPrismaErrorCode(null), null);
});

test("mantem sessao validada dentro de cinco minutos", () => {
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

test("fecha sessao sem validacao confiavel, invalida ou fora da janela", () => {
  const now = Date.parse("2026-07-05T10:00:00Z");
  assert.deepEqual(
    evaluateSessionDatabaseGrace({ now, lastValidatedAt: null, sessionInvalid: false }),
    { allowed: false, remainingMs: 0 },
  );
  assert.deepEqual(
    evaluateSessionDatabaseGrace({ now, lastValidatedAt: now, sessionInvalid: true }),
    { allowed: false, remainingMs: 0 },
  );
  assert.deepEqual(
    evaluateSessionDatabaseGrace({
      now,
      lastValidatedAt: now - SESSION_DATABASE_GRACE_MS,
      sessionInvalid: false,
    }),
    { allowed: false, remainingMs: 0 },
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test src/lib/auth-session-grace.test.ts`

Expected: FAIL because `./auth-session-grace` does not exist.

- [ ] **Step 3: Implement the minimal policy**

```ts
const TRANSIENT_PRISMA_SESSION_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
  "P2037",
]);

export const SESSION_DATABASE_GRACE_MS = 5 * 60_000;

export function getPrismaErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

export function isTransientPrismaSessionError(error: unknown) {
  const code = getPrismaErrorCode(error);
  return Boolean(code && TRANSIENT_PRISMA_SESSION_CODES.has(code));
}

export function evaluateSessionDatabaseGrace({
  now,
  lastValidatedAt,
  sessionInvalid,
}: {
  now: number;
  lastValidatedAt: number | null;
  sessionInvalid: boolean;
}) {
  if (sessionInvalid || lastValidatedAt === null || !Number.isFinite(lastValidatedAt)) {
    return { allowed: false, remainingMs: 0 };
  }
  const remainingMs = Math.max(0, SESSION_DATABASE_GRACE_MS - (now - lastValidatedAt));
  return { allowed: remainingMs > 0, remainingMs };
}
```

- [ ] **Step 4: Run the policy tests**

Run: `npx tsx --test src/lib/auth-session-grace.test.ts`

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit the policy**

```powershell
git add src/lib/auth-session-grace.ts src/lib/auth-session-grace.test.ts
git commit -m "feat: add bounded session database grace policy"
```

### Task 2: Sanitized structured diagnostics

**Files:**
- Modify: `src/lib/auth-session-grace.ts`
- Modify: `src/lib/auth-session-grace.test.ts`

- [ ] **Step 1: Add a failing log-safety test**

```ts
import { logSessionDatabaseFailure } from "./auth-session-grace";

test("log de tolerancia nao inclui identidade, SQL ou conexao", () => {
  const lines: string[] = [];
  logSessionDatabaseFailure({
    error: {
      code: "P2024",
      message: "postgresql://secret@host/db",
      meta: { query: "SELECT * FROM User", userId: "user-1" },
    },
    operation: "device_session_validation",
    graceApplied: true,
    remainingMs: 12_000,
    now: Date.parse("2026-07-05T10:00:00Z"),
    write: (line) => lines.push(line),
  });

  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    event: "auth_database_failure",
    timestamp: "2026-07-05T10:00:00.000Z",
    operation: "device_session_validation",
    prismaCode: "P2024",
    graceApplied: true,
    remainingGraceMs: 12_000,
  });
  assert.doesNotMatch(lines[0], /secret|SELECT|user-1|postgresql/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test src/lib/auth-session-grace.test.ts`

Expected: FAIL because `logSessionDatabaseFailure` is not exported.

- [ ] **Step 3: Add the sanitized logger**

```ts
type SessionDatabaseOperation =
  | "device_session_validation"
  | "user_state_refresh";

export function logSessionDatabaseFailure({
  error,
  operation,
  graceApplied,
  remainingMs,
  now = Date.now(),
  write = console.warn,
}: {
  error: unknown;
  operation: SessionDatabaseOperation;
  graceApplied: boolean;
  remainingMs: number;
  now?: number;
  write?: (line: string) => void;
}) {
  write(JSON.stringify({
    event: "auth_database_failure",
    timestamp: new Date(now).toISOString(),
    operation,
    prismaCode: getPrismaErrorCode(error),
    graceApplied,
    remainingGraceMs: Math.max(0, remainingMs),
  }));
}
```

- [ ] **Step 4: Run the complete helper test file**

Run: `npx tsx --test src/lib/auth-session-grace.test.ts`

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit diagnostics**

```powershell
git add src/lib/auth-session-grace.ts src/lib/auth-session-grace.test.ts
git commit -m "feat: log sanitized session database failures"
```

### Task 3: JWT integration

**Files:**
- Create: `src/lib/auth-session-grace-wiring.test.ts`
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Write the failing wiring test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const auth = readFileSync(join(process.cwd(), "src", "lib", "auth.ts"), "utf8");
const authTypes = readFileSync(join(process.cwd(), "src", "types", "next-auth.d.ts"), "utf8");

test("JWT registra a ultima validacao bem-sucedida", () => {
  assert.match(authTypes, /sessionValidatedAt\?: number \| null/);
  assert.match(auth, /token\.sessionValidatedAt = now/);
});

test("JWT aplica tolerancia nas duas fronteiras de banco", () => {
  assert.match(auth, /device_session_validation/);
  assert.match(auth, /user_state_refresh/);
  assert.match(auth, /isTransientPrismaSessionError/);
  assert.match(auth, /evaluateSessionDatabaseGrace/);
});

test("login novo continua sem tolerancia", () => {
  const initialUserBranch = auth.slice(
    auth.indexOf("if (user?.email)"),
    auth.indexOf("if (token.id && !token.sessionId)"),
  );
  assert.doesNotMatch(initialUserBranch, /evaluateSessionDatabaseGrace/);
});
```

- [ ] **Step 2: Run the wiring test to verify it fails**

Run: `npx tsx --test src/lib/auth-session-grace-wiring.test.ts`

Expected: FAIL because the JWT type and callback do not contain the grace integration.

- [ ] **Step 3: Extend the JWT type**

Add this property beside `sessionCheckedAt` in `src/types/next-auth.d.ts`:

```ts
sessionValidatedAt?: number | null;
```

- [ ] **Step 4: Import the policy in `src/lib/auth.ts`**

```ts
import {
  evaluateSessionDatabaseGrace,
  isTransientPrismaSessionError,
  logSessionDatabaseFailure,
} from "./auth-session-grace";
```

- [ ] **Step 5: Add a local transient-failure handler inside the JWT callback**

Immediately after `async jwt({ token, user }) {`, add:

```ts
const preserveEstablishedSessionDuringTransientFailure = (
  error: unknown,
  operation: "device_session_validation" | "user_state_refresh",
  now: number,
) => {
  const lastValidatedAt =
    typeof token.sessionValidatedAt === "number"
      ? token.sessionValidatedAt
      : typeof token.sessionCheckedAt === "number" && token.sessionCheckedAt > 0
        ? token.sessionCheckedAt
        : null;
  const grace = evaluateSessionDatabaseGrace({
    now,
    lastValidatedAt,
    sessionInvalid: token.sessionInvalid === true,
  });
  const graceApplied =
    Boolean(token.id && token.sessionId) &&
    isTransientPrismaSessionError(error) &&
    grace.allowed;
  logSessionDatabaseFailure({
    error,
    operation,
    graceApplied,
    remainingMs: grace.remainingMs,
    now,
  });
  if (!graceApplied) throw error;
  token.sessionCheckedAt = now;
};
```

- [ ] **Step 6: Protect device-session validation**

Replace the direct call inside the validation interval with:

```ts
try {
  const deviceSession = await validateDeviceSession(token.sessionId);
  token.sessionCheckedAt = now;
  shouldRefreshUserState = true;
  token.sessionInvalid = !deviceSession.valid;
  if (!deviceSession.valid) {
    token.id = undefined;
    return token;
  }
  token.sessionValidatedAt = now;
} catch (error) {
  preserveEstablishedSessionDuringTransientFailure(
    error,
    "device_session_validation",
    now,
  );
}
```

This preserves explicit invalid-session results and updates `sessionValidatedAt` only on success.

- [ ] **Step 7: Protect user-state refresh**

Wrap the existing `prisma.user.findUnique` refresh and token-field assignments:

```ts
try {
  const userState = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: {
      email: true,
      isBlocked: true,
      name: true,
      plan: true,
      role: true,
      subscriptionStatus: true,
      premiumUntil: true,
    },
  });
  token.email = userState?.email ?? token.email;
  token.isBlocked = userState?.isBlocked ?? true;
  token.name = userState?.name ?? token.name;
  token.plan = userState?.plan ?? token.plan;
  token.role = userState?.role ?? token.role;
  token.subscriptionStatus = userState?.subscriptionStatus ?? token.subscriptionStatus;
  token.premiumUntil = userState?.premiumUntil?.toISOString() ?? token.premiumUntil;
} catch (error) {
  preserveEstablishedSessionDuringTransientFailure(
    error,
    "user_state_refresh",
    Date.now(),
  );
}
```

- [ ] **Step 8: Run targeted tests**

Run: `npx tsx --test src/lib/auth-session-grace.test.ts src/lib/auth-session-grace-wiring.test.ts src/lib/session-state.test.ts src/lib/session-token.test.ts`

Expected: all tests PASS.

- [ ] **Step 9: Run lint**

Run: `npm run lint`

Expected: exit 0 with no ESLint errors.

- [ ] **Step 10: Commit JWT integration**

```powershell
git add src/lib/auth.ts src/types/next-auth.d.ts src/lib/auth-session-grace-wiring.test.ts
git commit -m "feat: preserve validated sessions during brief database failures"
```

### Task 4: Session verification

**Files:**
- Verify only; no expected source changes.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: exit 0 and all tests PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit 0. Report Prisma/Aiven reachability warnings separately if they appear.

- [ ] **Step 4: Confirm the worktree contains only intended changes**

Run: `git status --short`

Expected: clean worktree after the task commits.
