import assert from "node:assert/strict";
import { test } from "node:test";
import { getApprovedCheckoutReturnPaymentId, getCleanCheckoutReturnPath } from "./billing-return";

test("extrai payment_id quando retorno do Mercado Pago esta aprovado", () => {
  assert.equal(
    getApprovedCheckoutReturnPaymentId({
      checkout: "success",
      payment_id: "165226749686",
      status: "approved",
    }),
    "165226749686",
  );
});

test("ignora retorno sem aprovacao ou sem payment_id", () => {
  assert.equal(getApprovedCheckoutReturnPaymentId({ checkout: "pending", payment_id: "123", status: "pending" }), null);
  assert.equal(getApprovedCheckoutReturnPaymentId({ checkout: "success", payment_id: "", status: "approved" }), null);
});

test("limpa parametros sensiveis no retorno aprovado", () => {
  assert.equal(
    getCleanCheckoutReturnPath({
      checkout: "success",
      payment_id: "164408441419",
      status: "approved",
    }),
    "/assinaturas",
  );
});

test("mantem apenas status generico para retorno pendente ou cancelado", () => {
  assert.equal(getCleanCheckoutReturnPath({ checkout: "pending", payment_id: "123", status: "pending" }), "/assinaturas?checkout=pending");
  assert.equal(getCleanCheckoutReturnPath({ checkout: "cancel", payment_id: "123", status: "rejected" }), "/assinaturas?checkout=cancel");
});
