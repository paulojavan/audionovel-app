import assert from "node:assert/strict";
import { test } from "node:test";
import { createOfflineLicense } from "./offline-license";
import {
  getOfflineAccessState,
  verifyOfflineLicenseForClient,
} from "./offline-access";

const SECRET = "test-secret-with-enough-entropy";
const NOW = new Date("2026-07-10T12:00:00.000Z");

test("navegador valida a assinatura e o vinculo da licenca offline", async () => {
  const license = createOfflineLicense({
    userId: "user-1",
    sessionId: "session-1",
    premiumUntil: "2026-07-10T18:00:00.000Z",
    now: NOW,
    secret: SECRET,
  });

  const result = await verifyOfflineLicenseForClient({
    ...license,
    userId: "user-1",
    sessionId: "session-1",
    now: NOW.getTime(),
    lastObservedAt: NOW.getTime(),
  });

  assert.equal(result.state, "allowed");
  assert.equal(result.payload?.expiresAt, "2026-07-10T18:00:00.000Z");
});

test("navegador rejeita licenca adulterada", async () => {
  const license = createOfflineLicense({
    userId: "user-1",
    sessionId: "session-1",
    premiumUntil: "2026-07-10T18:00:00.000Z",
    now: NOW,
    secret: SECRET,
  });
  const [payload, signature] = license.token.split(".");

  const result = await verifyOfflineLicenseForClient({
    ...license,
    token: `${payload.slice(0, -1)}A.${signature}`,
    userId: "user-1",
    sessionId: "session-1",
    now: NOW.getTime(),
    lastObservedAt: NOW.getTime(),
  });

  assert.equal(result.state, "invalid");
});

test("acesso offline detecta retrocesso relevante do relogio", () => {
  assert.equal(
    getOfflineAccessState({
      issuedAt: NOW.getTime(),
      expiresAt: NOW.getTime() + 60 * 60_000,
      now: NOW.getTime() - 60 * 60_000,
      lastObservedAt: NOW.getTime(),
    }),
    "clock-rollback",
  );
});

test("acesso offline bloqueia no instante em que a licenca vence", () => {
  assert.equal(
    getOfflineAccessState({
      issuedAt: NOW.getTime(),
      expiresAt: NOW.getTime() + 60 * 60_000,
      now: NOW.getTime() + 60 * 60_000,
      lastObservedAt: NOW.getTime(),
    }),
    "expired",
  );
});
