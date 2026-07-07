import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const subscriptionsPage = readFileSync(
  join(process.cwd(), "src", "app", "assinaturas", "page.tsx"),
  "utf8",
);

test("pagina de assinaturas exibe o preco premium sem sufixo de periodo", () => {
  const premiumCard = subscriptionsPage.match(
    /<PlanCard\s+key=\{plan\.id\}[\s\S]*?features=\{\[/,
  )?.[0];

  assert.ok(premiumCard, "card premium deve continuar sendo renderizado");
  assert.match(premiumCard, /price=\{formatPlanPrice\(plan\.amountCents,\s*plan\.currency\)\}/);
  assert.doesNotMatch(premiumCard, /formatPlanInterval/);
  assert.doesNotMatch(premiumCard, /\s\/\s/);
});
