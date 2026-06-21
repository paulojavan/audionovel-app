import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMercadoPagoPreferencePayload, getCheckoutErrorMessage, isPixOnlyPlan, parseCheckoutReference } from "./billing-checkout";

const origin = "http://localhost:3000";
const userId = "user_123";
const userEmail = "user@example.com";
const userName = "Usuario";

test("plano apenas pix cria preferencia Mercado Pago sem cartao", () => {
  const params = buildMercadoPagoPreferencePayload({
    origin,
    userId,
    userEmail,
    userName,
    plan: {
      id: "plan_pix",
      name: "Assinatura 30 dias PIX",
      description: null,
      amountCents: 800,
      currency: "brl",
      interval: "month",
      allowCard: false,
      allowPix: true,
    },
  });

  assert.equal(params.items[0]?.unit_price, 8);
  assert.equal(params.metadata.premium_days, "30");
  assert.equal(params.notification_url, `${origin}/api/billing/webhook`);
  assert.ok(params.payment_methods?.excluded_payment_types?.some((method) => method.id === "credit_card"));
  assert.ok(!params.payment_methods?.excluded_payment_methods?.some((method) => method.id === "pix"));
});

test("plano de cartao cria preferencia Mercado Pago sem pix", () => {
  const params = buildMercadoPagoPreferencePayload({
    origin,
    userId,
    userEmail,
    userName,
    plan: {
      id: "plan_card",
      name: "Assinatura 30 dias Cartao",
      description: null,
      amountCents: 1000,
      currency: "brl",
      interval: "month",
      allowCard: true,
      allowPix: false,
    },
  });

  assert.equal(params.items[0]?.unit_price, 10);
  assert.ok(params.payment_methods?.excluded_payment_methods?.some((method) => method.id === "pix"));
  assert.equal(params.payment_methods?.installments, 12);
});

test("identifica plano apenas pix pelas flags do plano", () => {
  assert.equal(isPixOnlyPlan({ allowCard: false, allowPix: true }), true);
  assert.equal(isPixOnlyPlan({ allowCard: true, allowPix: false }), false);
  assert.equal(isPixOnlyPlan({ allowCard: true, allowPix: true }), false);
});

test("parseia referencia externa do checkout", () => {
  assert.deepEqual(parseCheckoutReference("user:user_123;plan:plan_pix;days:30"), {
    userId: "user_123",
    planId: "plan_pix",
    premiumDays: 30,
  });
  assert.equal(parseCheckoutReference("invalid"), null);
});

test("traduz erro de configuracao em mensagem acionavel", () => {
  assert.equal(
    getCheckoutErrorMessage({ message: "Invalid access token" }),
    "Mercado Pago nao configurado. Verifique MERCADO_PAGO_ACCESS_TOKEN.",
  );
});
