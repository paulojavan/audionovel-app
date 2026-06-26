import assert from "node:assert/strict";
import { test } from "node:test";
import { getPasswordResetDeliveryConfig } from "./password-reset-store";

test("recuperacao de senha em producao exige webhook de entrega", () => {
  assert.equal(getPasswordResetDeliveryConfig({ NODE_ENV: "production" }).configured, false);
});

test("recuperacao de senha fica configurada quando webhook existe", () => {
  assert.equal(
    getPasswordResetDeliveryConfig({
      NODE_ENV: "production",
      PASSWORD_RESET_WEBHOOK_URL: "https://example.com/password-reset",
    }).configured,
    true,
  );
});

test("desenvolvimento pode usar link de teste sem webhook", () => {
  assert.equal(getPasswordResetDeliveryConfig({ NODE_ENV: "development" }).configured, true);
});
