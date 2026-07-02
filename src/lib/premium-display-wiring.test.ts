import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const userMenu = readFileSync("src/components/user-menu.tsx", "utf8");
const adminUsers = readFileSync("src/app/admin/usuarios/page.tsx", "utf8");
const adminDashboard = readFileSync("src/app/admin/page.tsx", "utf8");

test("menu recebe o plano efetivo calculado no servidor", () => {
  assert.match(layout, /getSubscriptionDisplayState/);
  assert.match(layout, /planLabel=\{subscriptionDisplay\.planLabel\}/);
  assert.match(userMenu, /planLabel\?: string/);
  assert.doesNotMatch(userMenu, /user\.plan\s*\?\?/);
});

test("lista administrativa usa plano e status efetivos", () => {
  assert.match(adminUsers, /getSubscriptionDisplayState/);
  assert.match(adminUsers, /subscriptionDisplay\.planLabel/);
  assert.match(adminUsers, /subscriptionDisplay\.statusLabel/);
});

test("dashboard conta apenas Premium vigente", () => {
  assert.match(adminDashboard, /"subscriptionStatus" IN \('ACTIVE', 'TRIALING'\)/);
  assert.match(adminDashboard, /"premiumUntil" > CURRENT_TIMESTAMP/);
  assert.doesNotMatch(adminDashboard, /"plan" = 'PREMIUM' OR/);
});
