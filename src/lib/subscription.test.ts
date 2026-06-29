import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatPremiumDaysLabel,
  getPremiumDaysLabel,
  getRemainingPremiumDays,
  hasPremiumAccess,
} from "./subscription";

test("hasPremiumAccess nao libera assinatura active sem validade premium", () => {
  assert.equal(hasPremiumAccess({ subscriptionStatus: "ACTIVE", premiumUntil: null }), false);
});

test("hasPremiumAccess libera assinatura active com validade futura", () => {
  assert.equal(hasPremiumAccess({ subscriptionStatus: "ACTIVE", premiumUntil: "2099-01-01T00:00:00.000Z" }), true);
});

test("getRemainingPremiumDays arredonda uma fracao futura para cima", () => {
  const now = new Date("2026-06-29T12:00:00Z");

  assert.equal(getRemainingPremiumDays("2026-06-30T11:59:59Z", now), 1);
  assert.equal(getRemainingPremiumDays("2026-07-01T12:00:00Z", now), 2);
});

test("getRemainingPremiumDays retorna zero para data ausente invalida ou expirada", () => {
  const now = new Date("2026-06-29T12:00:00Z");

  assert.equal(getRemainingPremiumDays(null, now), 0);
  assert.equal(getRemainingPremiumDays("invalida", now), 0);
  assert.equal(getRemainingPremiumDays("2026-06-29T12:00:00Z", now), 0);
});

test("formatPremiumDaysLabel respeita singular e plural", () => {
  assert.equal(formatPremiumDaysLabel(1), "1 dia de Premium");
  assert.equal(formatPremiumDaysLabel(8), "8 dias de Premium");
});

test("getPremiumDaysLabel mostra zero para usuario free", () => {
  const now = new Date("2026-06-29T12:00:00Z");

  assert.equal(
    getPremiumDaysLabel(
      { subscriptionStatus: "NONE", premiumUntil: null },
      now,
    ),
    "0 dias de Premium",
  );
});

test("getPremiumDaysLabel mantem a contagem para usuario premium", () => {
  const now = new Date("2026-06-29T12:00:00Z");

  assert.equal(
    getPremiumDaysLabel(
      {
        subscriptionStatus: "ACTIVE",
        premiumUntil: "2026-06-30T12:00:00Z",
      },
      now,
    ),
    "1 dia de Premium",
  );
});
