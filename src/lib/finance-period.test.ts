import assert from "node:assert/strict";
import { test } from "node:test";
import { getFinanceMonthPeriod } from "./finance-period";

test("monta periodo mensal a partir de yyyy-mm", () => {
  const period = getFinanceMonthPeriod("2026-06");

  assert.equal(period.month, "2026-06");
  assert.equal(period.start.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-07-01T00:00:00.000Z");
});

test("usa mes atual em UTC quando parametro e invalido", () => {
  const period = getFinanceMonthPeriod("junho", new Date("2026-08-15T12:00:00.000Z"));

  assert.equal(period.month, "2026-08");
  assert.equal(period.start.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-09-01T00:00:00.000Z");
});
