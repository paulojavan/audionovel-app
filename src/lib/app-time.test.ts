import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_TIME_ZONE,
  appZonedDateTimeToDate,
  formatAppDate,
  formatAppDateTime,
  getAppDateInputValue,
  getAppMonthInputValue,
  parseAppDateEndOfDay,
} from "./app-time";

test("uses the Sao Paulo application timezone explicitly", () => {
  assert.equal(APP_TIME_ZONE, "America/Sao_Paulo");
  assert.equal(formatAppDateTime("2026-07-28T14:00:00.000Z"), "28/07/2026, 11:00:00");
  assert.equal(formatAppDate("2026-07-29T02:30:00.000Z"), "28/07/2026");
});

test("creates date and month input values at Sao Paulo boundaries", () => {
  const instant = "2026-08-01T01:30:00.000Z";
  assert.equal(getAppDateInputValue(instant), "2026-07-31");
  assert.equal(getAppMonthInputValue(instant), "2026-07");
});

test("converts Sao Paulo wall-clock dates to UTC instants", () => {
  assert.equal(appZonedDateTimeToDate(2026, 7, 1).toISOString(), "2026-07-01T03:00:00.000Z");
  assert.equal(parseAppDateEndOfDay("2026-07-28")?.toISOString(), "2026-07-29T02:59:59.999Z");
  assert.equal(parseAppDateEndOfDay("2026-02-31"), null);
  assert.equal(parseAppDateEndOfDay("28/07/2026"), null);
});
