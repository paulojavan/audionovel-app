import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const authSource = readFileSync(join(process.cwd(), "src", "lib", "auth.ts"), "utf8");
const authTypesSource = readFileSync(
  join(process.cwd(), "src", "types", "next-auth.d.ts"),
  "utf8",
);

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);

  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("adds the last successful database validation timestamp to the JWT type", () => {
  assert.match(authTypesSource, /sessionValidatedAt\?: number \| null;/);
});

test("imports and logs the established-session database grace policy for both operations", () => {
  assert.match(
    authSource,
    /import\s*\{[\s\S]*?evaluateSessionDatabaseGrace[\s\S]*?isTransientPrismaSessionError[\s\S]*?logSessionDatabaseFailure[\s\S]*?\}\s*from "\.\/auth-session-grace";/,
  );
  assert.match(authSource, /operation:\s*"device_session_validation"/);
  assert.match(authSource, /operation:\s*"user_state_refresh"/);
});

test("keeps new-login hydration fail-closed without invoking database grace", () => {
  const newLoginBranch = sourceBetween(
    authSource,
    "if (user?.email) {",
    "if (token.id && !token.sessionId)",
  );

  assert.match(newLoginBranch, /await prisma\.user\.findUnique/);
  assert.doesNotMatch(newLoginBranch, /evaluateSessionDatabaseGrace/);
  assert.doesNotMatch(newLoginBranch, /isTransientPrismaSessionError/);
  assert.doesNotMatch(newLoginBranch, /logSessionDatabaseFailure/);
});

test("records successful device validation as the trustworthy grace anchor", () => {
  const establishedSessionBranch = sourceBetween(
    authSource,
    "if (token.sessionId) {",
    "if (token.id && shouldRefreshUserState)",
  );

  assert.match(establishedSessionBranch, /token\.sessionCheckedAt = now;/);
  assert.match(establishedSessionBranch, /token\.sessionValidatedAt = now;/);
});

test("handles explicit invalid device sessions before catch-based database grace", () => {
  const establishedSessionBranch = sourceBetween(
    authSource,
    "if (token.sessionId) {",
    "if (token.id && shouldRefreshUserState)",
  );
  const explicitInvalidIndex = establishedSessionBranch.indexOf("if (!deviceSession.valid)");
  const clearIdentityIndex = establishedSessionBranch.indexOf("token.id = undefined", explicitInvalidIndex);
  const returnIndex = establishedSessionBranch.indexOf("return token", explicitInvalidIndex);
  const catchIndex = establishedSessionBranch.indexOf("catch (error)");
  const graceIndex = establishedSessionBranch.indexOf("evaluateDatabaseGrace", catchIndex);

  assert.ok(explicitInvalidIndex >= 0);
  assert.ok(clearIdentityIndex > explicitInvalidIndex);
  assert.ok(returnIndex > clearIdentityIndex);
  assert.ok(catchIndex > returnIndex);
  assert.ok(graceIndex > catchIndex);
});
