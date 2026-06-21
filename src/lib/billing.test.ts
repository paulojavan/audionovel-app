import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateFixedPremiumUntil,
  hasPremiumAccessAt,
} from "./billing";

const now = new Date("2026-06-21T12:00:00.000Z");

test("premium ativo precisa de data futura para liberar acesso", () => {
  assert.equal(hasPremiumAccessAt({ subscriptionStatus: "ACTIVE", premiumUntil: "2026-06-22T00:00:00.000Z" }, now), true);
  assert.equal(hasPremiumAccessAt({ subscriptionStatus: "ACTIVE", premiumUntil: null }, now), false);
  assert.equal(hasPremiumAccessAt({ subscriptionStatus: "ACTIVE", premiumUntil: "2026-06-20T00:00:00.000Z" }, now), false);
});

test("trialing com data futura libera acesso e cancelado nao libera", () => {
  assert.equal(hasPremiumAccessAt({ subscriptionStatus: "TRIALING", premiumUntil: "2026-06-22T00:00:00.000Z" }, now), true);
  assert.equal(hasPremiumAccessAt({ subscriptionStatus: "CANCELED", premiumUntil: "2026-06-22T00:00:00.000Z" }, now), false);
});

test("admin mantem acesso premium independente da assinatura", () => {
  assert.equal(hasPremiumAccessAt({ role: "ADMIN", subscriptionStatus: "CANCELED", premiumUntil: null }, now), true);
});

test("pagamento fixo premium inicia a validade a partir de agora quando usuario e free", () => {
  assert.equal(
    calculateFixedPremiumUntil(null, 30, new Date("2026-06-21T12:00:00.000Z")).toISOString(),
    "2026-07-21T12:00:00.000Z",
  );
});

test("pagamento fixo premium estende a partir da validade atual quando ainda esta ativo", () => {
  assert.equal(
    calculateFixedPremiumUntil(
      new Date("2026-07-01T12:00:00.000Z"),
      30,
      new Date("2026-06-21T12:00:00.000Z"),
    ).toISOString(),
    "2026-07-31T12:00:00.000Z",
  );
});
