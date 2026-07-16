import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const offlinePage = readFileSync(join(process.cwd(), "src", "app", "offline", "page.tsx"), "utf8");
const prepareRoute = readFileSync(join(process.cwd(), "src", "app", "api", "offline", "prepare", "route.ts"), "utf8");

test("pagina offline envolve o player com licenca vinculada a sessao", () => {
  assert.match(offlinePage, /createOfflineLicense/);
  assert.match(offlinePage, /session\.user\.sessionId/);
  assert.match(offlinePage, /<OfflinePremiumGate/);
  assert.match(offlinePage, /license=\{license\}/);
});

test("preparacao limita metadados e audio a validade da licenca offline", () => {
  assert.match(prepareRoute, /getOfflineLicenseExpiry/);
  assert.match(prepareRoute, /auth\.user\.premiumUntil/);
  assert.doesNotMatch(prepareRoute, /Date\.now\(\) \+ 1000 \* 60 \* 60 \* 24 \* 7/);
});

test("gate local valida assinatura e acompanha vencimento enquanto a pagina esta aberta", () => {
  const gate = readFileSync(join(process.cwd(), "src", "components", "offline-premium-gate.tsx"), "utf8");
  assert.match(gate, /verifyOfflineLicenseForClient/);
  assert.match(gate, /localStorage/);
  assert.match(gate, /setInterval/);
  assert.match(gate, /Seu Premium venceu/);
  assert.match(gate, /Nao foi possivel validar o acesso offline/);
  assert.match(gate, /accessState === "expired"/);
});
