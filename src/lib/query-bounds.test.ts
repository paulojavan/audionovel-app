import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

test("listas administrativas e privadas possuem limites explicitos", () => {
  assert.match(source("src", "app", "admin", "usuarios", "page.tsx"), /take:\s*50/);
  assert.match(source("src", "app", "notificacoes", "page.tsx"), /take:\s*100/);
  assert.match(source("src", "app", "offline", "page.tsx"), /take:\s*100/);
});

test("usuarios administrativos possuem paginacao", () => {
  const users = source("src", "app", "admin", "usuarios", "page.tsx");
  assert.match(users, /skip:\s*\(currentPage - 1\) \* PAGE_SIZE/);
  assert.match(users, /Pagina \{currentPage\}/);
});
