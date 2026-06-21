import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveApprovedPaymentReference } from "./billing-reconciliation";

test("resolve referencia de pagamento aprovado do Mercado Pago", () => {
  assert.deepEqual(
    resolveApprovedPaymentReference({
      id: "165226749686",
      status: "approved",
      external_reference: "user:user_123;plan:plan_123;days:30",
    }),
    {
      paymentId: "165226749686",
      userId: "user_123",
      planId: "plan_123",
      premiumDays: 30,
    },
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
