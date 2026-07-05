import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const heartbeatPath = join(
  process.cwd(),
  "src",
  "components",
  "session-heartbeat.tsx",
);
const heartbeatSource = existsSync(heartbeatPath)
  ? readFileSync(heartbeatPath, "utf8")
  : "";
const layoutSource = readFileSync(
  join(process.cwd(), "src", "app", "layout.tsx"),
  "utf8",
);

test("refreshes the NextAuth session cookie immediately and every sixty seconds", () => {
  assert.equal(existsSync(heartbeatPath), true);
  assert.match(heartbeatSource, /^"use client";/);
  assert.match(
    heartbeatSource,
    /fetch\("\/api\/auth\/session",\s*\{\s*method:\s*"GET",\s*credentials:\s*"same-origin",\s*cache:\s*"no-store",?\s*\}\)/,
  );
  assert.match(heartbeatSource, /refreshSession\(\);/);
  assert.match(
    heartbeatSource,
    /setInterval\(refreshSession,\s*60_000\)/,
  );
  assert.match(heartbeatSource, /\.catch\(\(\) => undefined\)/);
});

test("refreshes when the document returns visible and cleans up browser subscriptions", () => {
  assert.match(
    heartbeatSource,
    /document\.visibilityState === "visible"[\s\S]*?refreshSession\(\)/,
  );
  assert.match(
    heartbeatSource,
    /document\.addEventListener\("visibilitychange",\s*handleVisibilityChange\)/,
  );
  assert.match(heartbeatSource, /clearInterval\(intervalId\)/);
  assert.match(
    heartbeatSource,
    /document\.removeEventListener\("visibilitychange",\s*handleVisibilityChange\)/,
  );
  assert.match(heartbeatSource, /return null;/);
});

test("renders the heartbeat from the root layout only for an active session", () => {
  assert.match(
    layoutSource,
    /import\s*\{\s*SessionHeartbeat\s*\}\s*from "@\/components\/session-heartbeat";/,
  );
  assert.match(
    layoutSource,
    /\{activeSession\s*\?\s*<SessionHeartbeat\s*\/>\s*:\s*null\}/,
  );
  assert.equal(
    (layoutSource.match(/<SessionHeartbeat\s*\/>/g) ?? []).length,
    1,
  );
});
