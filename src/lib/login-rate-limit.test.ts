import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const authSource = readFileSync(join(process.cwd(), "src", "lib", "auth.ts"), "utf8");

test("login limita IP e email antes de consultar senha", () => {
  const rateLimitIndex = authSource.indexOf("consumeRateLimit");
  const passwordIndex = authSource.indexOf("const validPassword = await verifyPassword");

  assert.notEqual(rateLimitIndex, -1);
  assert.notEqual(passwordIndex, -1);
  assert.ok(rateLimitIndex < passwordIndex);
  assert.match(authSource, /login:ip:/);
  assert.match(authSource, /login:email:/);
});
