import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const routeSource = readFileSync(
  join(process.cwd(), "src", "app", "api", "admin", "chapters", "route.ts"),
  "utf8",
);

test("POST devolve a primeira mensagem do schema no erro 400", () => {
  assert.match(routeSource, /const validationError = batchPayload \? batch\.error : single\.error/);
  assert.match(routeSource, /validationError\.issues\[0\]\?\.message \?\? "Dados invalidos\."/);
});
