import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

const authSource = source("src", "lib", "auth.ts");
const proxySource = source("src", "proxy.ts");
const rateLimitSource = source("src", "lib", "rate-limit.ts");
const profileSource = source("src", "app", "api", "profile", "route.ts");
const globalErrorSource = source("src", "app", "global-error.tsx");

test("login nao cria bucket global nem vincula sessao ao user-agent completo", () => {
  assert.doesNotMatch(rateLimitSource, /ip:\$\{ip \|\| "unknown"\}|return "ip:unknown"/);
  assert.match(authSource, /if \(requestIdentifier\) \{[\s\S]*?consumeRateLimit/);
  assert.doesNotMatch(proxySource, /userAgentMatches|hashSessionValue/);
  assert.doesNotMatch(authSource, /token\.userAgentHash|userAgentHash:\s*deviceSession/);
});

test("troca de senha valida a senha atual sob o mesmo bloqueio da atualizacao", () => {
  const transactionBlock = profileSource.match(
    /prisma\.\$transaction\(async \(tx\) => \{[\s\S]*?\n    \}\);/,
  )?.[0] ?? "";

  assert.match(transactionBlock, /SELECT "passwordHash"[\s\S]*?FOR UPDATE/);
  assert.match(transactionBlock, /verifyPassword/);
  assert.ok(
    transactionBlock.indexOf("FOR UPDATE") <
      transactionBlock.indexOf("tx.user.update"),
  );
});

test("erro global preserva uma tela de recuperacao mesmo se o layout falhar", () => {
  assert.match(globalErrorSource, /^"use client";/);
  assert.match(globalErrorSource, /<html lang="pt-BR">/);
  assert.match(globalErrorSource, /<body/);
  assert.match(globalErrorSource, /onClick=\{(?:\(\) => )?unstable_retry(?:\(\))?\}/);
});
