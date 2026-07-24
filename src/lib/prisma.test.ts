import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(process.cwd(), "src", "lib", "prisma.ts"), "utf8");

test("prisma client reutiliza a instancia registrada em globalThis", () => {
  assert.match(source, /globalForPrisma\.prisma \?\?/);
  assert.match(source, /globalForPrisma\.prisma = prisma;/);
});

test("compartilhamento do prisma client nao depende do ambiente", () => {
  // Um gate por NODE_ENV faz cada grafo de modulos do build de producao
  // (RSC e SSR) abrir seu proprio pool de conexoes, causando P2024/P2037.
  assert.doesNotMatch(source, /if \(process\.env\.NODE_ENV/);
});
