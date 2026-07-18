import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const authSource = readFileSync(join(process.cwd(), "src", "lib", "auth.ts"), "utf8");
const refreshSource = readFileSync(
  join(process.cwd(), "src", "lib", "auth-session-refresh.ts"),
  "utf8",
);
const authTypesSource = readFileSync(
  join(process.cwd(), "src", "types", "next-auth.d.ts"),
  "utf8",
);
const safeAuthSource = readFileSync(
  join(process.cwd(), "src", "lib", "safe-auth-session.ts"),
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

test("delegates established-session refresh with both safe database failure operations", () => {
  assert.match(
    authSource,
    /import\s*\{\s*logSessionDatabaseFailure\s*\}\s*from "\.\/auth-session-grace";/,
  );
  assert.match(
    authSource,
    /import\s*\{\s*refreshEstablishedSession\s*\}\s*from "\.\/auth-session-refresh";/,
  );
  assert.match(authSource, /await refreshEstablishedSession\(\{/);
  assert.match(authSource, /findUserState:\s*\(userId\)[\s\S]*?where:\s*\{\s*id:\s*userId\s*\}/);
  assert.match(refreshSource, /operation:\s*"device_session_validation"/);
  assert.match(refreshSource, /operation:\s*"user_state_refresh"/);
});

test("coalesces simultaneous established-session database lookups", () => {
  assert.match(
    authSource,
    /import\s*\{\s*createAsyncTtlCache\s*\}\s*from "\.\/async-ttl-cache";/,
  );
  assert.match(
    authSource,
    /const deviceSessionRefreshCache = createAsyncTtlCache<[\s\S]*?ttlMs:\s*0,[\s\S]*?maxEntries:\s*1_024/,
  );
  assert.match(
    authSource,
    /const userStateRefreshCache = createAsyncTtlCache<[\s\S]*?ttlMs:\s*0,[\s\S]*?maxEntries:\s*1_024/,
  );

  const establishedSessionRefresh = sourceBetween(
    authSource,
    "await refreshEstablishedSession({",
    "return token;",
  );
  assert.match(
    establishedSessionRefresh,
    /validateDeviceSession:\s*\(sessionId\)\s*=>\s*deviceSessionRefreshCache\.get\(/,
  );
  assert.match(
    establishedSessionRefresh,
    /findUserState:\s*\(userId\)\s*=>\s*userStateRefreshCache\.get\(/,
  );
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
  const userStateAssignmentIndex = refreshSource.indexOf(
    "token.subscriptionStatus =",
  );
  const validationAnchorIndex = refreshSource.indexOf(
    "token.sessionValidatedAt = now;",
  );

  assert.ok(userStateAssignmentIndex >= 0);
  assert.ok(validationAnchorIndex > userStateAssignmentIndex);
  assert.doesNotMatch(authSource, /token\.sessionValidatedAt = now;/);
});

test("handles explicit invalid device sessions before any user-state refresh", () => {
  const explicitInvalidIndex = refreshSource.indexOf("if (!deviceSession.valid)");
  const clearIdentityIndex = refreshSource.indexOf("token.id = undefined", explicitInvalidIndex);
  const returnIndex = refreshSource.indexOf("return token", explicitInvalidIndex);
  const userRefreshIndex = refreshSource.indexOf("await findUserState");

  assert.ok(explicitInvalidIndex >= 0);
  assert.ok(clearIdentityIndex > explicitInvalidIndex);
  assert.ok(returnIndex > clearIdentityIndex);
  assert.ok(userRefreshIndex > returnIndex);
});

test("safe session fallback preserves validated JWT during transient database failure", () => {
  assert.match(safeAuthSource, /isTransientPrismaSessionError/);
  assert.match(safeAuthSource, /evaluateSessionDatabaseGrace/);
  assert.match(safeAuthSource, /buildSessionFromToken/);
  assert.match(safeAuthSource, /catch \(error\)[\s\S]*isTransientPrismaSessionError\(error\)/);
  assert.match(safeAuthSource, /grace\.allowed[\s\S]*return buildSessionFromToken/);
  assert.match(safeAuthSource, /return null/);
});
