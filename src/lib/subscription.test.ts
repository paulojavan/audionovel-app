import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatPremiumDaysLabel,
  getPremiumDaysLabel,
  getRemainingPremiumDays,
  getSubscriptionDisplayState,
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

test("estado visual marca Premium vigente como ativo", () => {
  const now = new Date("2026-07-02T12:00:00Z");

  assert.deepEqual(
    getSubscriptionDisplayState(
      {
        plan: "PREMIUM",
        subscriptionStatus: "ACTIVE",
        premiumUntil: "2026-07-03T12:00:00Z",
      },
      now,
    ),
    { isPremium: true, planLabel: "Premium", statusLabel: "Ativo" },
  );
});

test("estado visual marca Premium vencido como Free e Expirado", () => {
  const now = new Date("2026-07-02T12:00:00Z");

  for (const premiumUntil of ["2026-07-01T23:59:59Z", "2026-07-02T12:00:00Z"]) {
    assert.deepEqual(
      getSubscriptionDisplayState(
        { plan: "PREMIUM", subscriptionStatus: "ACTIVE", premiumUntil },
        now,
      ),
      { isPremium: false, planLabel: "Free", statusLabel: "Expirado" },
    );
  }
});

test("estado visual marca conta sem Premium como Free e Inativo", () => {
  assert.deepEqual(
    getSubscriptionDisplayState({
      plan: "FREE",
      subscriptionStatus: "NONE",
      premiumUntil: null,
    }),
    { isPremium: false, planLabel: "Free", statusLabel: "Inativo" },
  );
});
