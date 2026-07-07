import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveApprovedPaymentReference, resolvePaymentEventUserId, validateCheckoutPayment } from "./billing-reconciliation";

test("referencia legada nao pode liberar premium sem intencao local", () => {
  assert.equal(
    resolveApprovedPaymentReference({
      id: "165226749686",
      status: "approved",
      external_reference: "user:user_123;plan:plan_123;days:30",
    }),
    null,
  );
});

test("rejeita pagamento aprovado que pertence a outro usuario", () => {
  assert.equal(
    resolveApprovedPaymentReference(
      {
        id: "165226749686",
        status: "approved",
        external_reference: "user:user_123;plan:plan_123;days:30",
      },
      "user_456",
    ),
    null,
  );
});

test("ignora pagamento pendente ou sem referencia local", () => {
  assert.equal(resolveApprovedPaymentReference({ id: "1", status: "pending" }), null);
  assert.equal(resolveApprovedPaymentReference({ id: "1", status: "approved" }), null);
});

test("resolve usuario de evento pendente pela intencao de checkout", () => {
  assert.equal(
    resolvePaymentEventUserId(
      { id: "payment-1", status: "pending", external_reference: "checkout_intent_1" },
      { id: "checkout_intent_1", userId: "user-1" },
    ),
    "user-1",
  );
  assert.equal(
    resolvePaymentEventUserId(
      { id: "payment-1", status: "pending", external_reference: "checkout_intent_1" },
      { id: "checkout_intent_2", userId: "user-2" },
    ),
    null,
  );
  assert.equal(resolvePaymentEventUserId({ id: "payment-1", status: "pending" }, null), null);
});

test("valida valor moeda validade uso e usuario da intencao", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");
  const payment = {
    id: "payment-1",
    status: "approved",
    transaction_amount: 19.9,
    currency_id: "BRL",
  };
  const intent = {
    userId: "user-1",
    planId: "plan-1",
    premiumDays: 30,
    usedAt: null,
    expiresAt: new Date("2026-07-01T13:00:00.000Z"),
  };
  const plan = { amountCents: 1990, currency: "brl" };

  assert.equal(validateCheckoutPayment(payment, intent, plan, now, "user-1"), true);
  assert.equal(validateCheckoutPayment({ ...payment, transaction_amount: 1 }, intent, plan, now), false);
  assert.equal(validateCheckoutPayment({ ...payment, currency_id: "USD" }, intent, plan, now), false);
  assert.equal(validateCheckoutPayment(payment, { ...intent, usedAt: now }, plan, now), false);
  assert.equal(
    validateCheckoutPayment(payment, { ...intent, expiresAt: new Date("2026-07-01T11:00:00.000Z") }, plan, now),
    false,
  );
  assert.equal(validateCheckoutPayment(payment, intent, plan, now, "user-2"), false);
});
