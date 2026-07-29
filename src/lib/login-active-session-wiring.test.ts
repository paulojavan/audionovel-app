import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const loginPageSource = readFileSync(
  join(process.cwd(), "src", "app", "login", "page.tsx"),
  "utf8",
);

test("login redireciona uma sessao ja ativa sem aceitar novas tentativas", () => {
  assert.match(loginPageSource, /await getActiveServerSession\(\)/);
  assert.match(loginPageSource, /if \(session\) \{/);
  assert.match(loginPageSource, /redirect\(safeCallbackUrl\)/);
  assert.match(loginPageSource, /!callbackUrl\.startsWith\("\/login"\)/);
});
