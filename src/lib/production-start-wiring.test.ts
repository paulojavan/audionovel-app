import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { scripts?: { start?: string } };

test("production start keeps Next.js connections alive longer than the proxy", () => {
  assert.equal(
    packageJson.scripts?.start,
    "next start --keepAliveTimeout 70000",
  );
});
