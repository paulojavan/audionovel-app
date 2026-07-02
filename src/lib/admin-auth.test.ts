import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function collectRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectRoutes(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

test("rotas administrativas delegam autorizacao ao requireAdmin", () => {
  const routes = collectRoutes(join(process.cwd(), "src", "app", "api", "admin"));
  assert.ok(routes.length > 0);

  for (const route of routes) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /requireAdmin\(\)/, route);
    assert.doesNotMatch(source, /auth\.user\.role !== "ADMIN"/, route);
  }
});
