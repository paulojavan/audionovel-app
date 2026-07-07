import assert from "node:assert/strict";
import { test } from "node:test";
import { getConfirmedPaymentWhere, getPendingPaymentWhere } from "./admin-payments";

test("filtros admin separam vendas confirmadas de eventos pendentes", () => {
  const createdAt = {
    gte: new Date("2026-07-01T00:00:00.000Z"),
    lt: new Date("2026-08-01T00:00:00.000Z"),
  };

  assert.deepEqual(getConfirmedPaymentWhere(createdAt), {
    createdAt,
    status: "SUCCEEDED",
  });
  assert.deepEqual(getPendingPaymentWhere(createdAt), {
    createdAt,
    status: { not: "SUCCEEDED" },
  });
});
