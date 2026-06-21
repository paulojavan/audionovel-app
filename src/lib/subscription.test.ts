import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPremiumAccess } from "./subscription";

test("hasPremiumAccess nao libera assinatura active sem validade premium", () => {
  assert.equal(hasPremiumAccess({ subscriptionStatus: "ACTIVE", premiumUntil: null }), false);
});

test("hasPremiumAccess libera assinatura active com validade futura", () => {
  assert.equal(hasPremiumAccess({ subscriptionStatus: "ACTIVE", premiumUntil: "2099-01-01T00:00:00.000Z" }), true);
});
