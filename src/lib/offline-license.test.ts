import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createOfflineLicense,
  getOfflineLicenseExpiry,
  verifyOfflineLicense,
} from "./offline-license";

const SECRET = "test-secret-with-enough-entropy";
const NOW = new Date("2026-07-10T12:00:00.000Z");

test("licenca offline termina no premiumUntil quando ele vem antes de 24 horas", () => {
  const premiumUntil = new Date("2026-07-10T18:00:00.000Z");

  assert.equal(
    getOfflineLicenseExpiry(premiumUntil, NOW).toISOString(),
    premiumUntil.toISOString(),
  );
});

test("licenca offline acompanha os trinta dias restantes do premium", () => {
  assert.equal(
    getOfflineLicenseExpiry(new Date("2026-08-10T12:00:00.000Z"), NOW).toISOString(),
    "2026-08-10T12:00:00.000Z",
  );
});

test("licenca v2 fica vinculada ao dispositivo estavel e nao a sessao", () => {
  const license = createOfflineLicense({
    userId: "user-1",
    deviceId: "device-1",
    premiumUntil: new Date("2026-08-10T12:00:00.000Z"),
    now: NOW,
    secret: SECRET,
  });

  const payload = verifyOfflineLicense(license.token, {
    userId: "user-1",
    deviceId: "device-1",
    now: new Date("2026-07-12T12:00:00.000Z"),
    secret: SECRET,
  });

  assert.equal(payload.version, 2);
  assert.equal(payload.deviceId, "device-1");
  assert.equal(payload.expiresAt, "2026-08-10T12:00:00.000Z");
});

test("licenca v2 rejeita outro dispositivo", () => {
  const license = createOfflineLicense({
    userId: "user-1",
    deviceId: "device-1",
    premiumUntil: new Date("2026-08-10T12:00:00.000Z"),
    now: NOW,
    secret: SECRET,
  });

  assert.throws(
    () => verifyOfflineLicense(license.token, {
      userId: "user-1",
      deviceId: "device-2",
      now: NOW,
      secret: SECRET,
    }),
    /Licenca offline invalida/,
  );
});

test("admin recebe licenca de 24 horas mesmo sem premiumUntil", () => {
  assert.equal(
    getOfflineLicenseExpiry(null, NOW, "ADMIN").toISOString(),
    "2026-07-11T12:00:00.000Z",
  );
});

test("licenca assinada fica vinculada ao usuario e a sessao do dispositivo", () => {
  const license = createOfflineLicense({
    userId: "user-1",
    sessionId: "session-1",
    premiumUntil: new Date("2026-07-10T18:00:00.000Z"),
    now: NOW,
    secret: SECRET,
  });

  const payload = verifyOfflineLicense(license.token, {
    userId: "user-1",
    sessionId: "session-1",
    now: NOW,
    secret: SECRET,
  });

  assert.equal(payload.expiresAt, "2026-07-10T18:00:00.000Z");
  assert.equal(payload.userId, "user-1");
  assert.equal(payload.sessionId, "session-1");
  assert.ok(license.publicKey.length > 40);
});

test("licenca adulterada ou usada por outra sessao e rejeitada", () => {
  const license = createOfflineLicense({
    userId: "user-1",
    sessionId: "session-1",
    premiumUntil: new Date("2026-07-10T18:00:00.000Z"),
    now: NOW,
    secret: SECRET,
  });
  const [payload, signature] = license.token.split(".");
  const tamperedToken = `${payload.slice(0, -1)}A.${signature}`;

  assert.throws(
    () => verifyOfflineLicense(tamperedToken, {
      userId: "user-1",
      sessionId: "session-1",
      now: NOW,
      secret: SECRET,
    }),
    /Licenca offline invalida/,
  );
  assert.throws(
    () => verifyOfflineLicense(license.token, {
      userId: "user-1",
      sessionId: "session-2",
      now: NOW,
      secret: SECRET,
    }),
    /Licenca offline invalida/,
  );
});

test("licenca expirada e rejeitada mesmo com assinatura valida", () => {
  const license = createOfflineLicense({
    userId: "user-1",
    sessionId: "session-1",
    premiumUntil: new Date("2026-07-10T18:00:00.000Z"),
    now: NOW,
    secret: SECRET,
  });

  assert.throws(
    () => verifyOfflineLicense(license.token, {
      userId: "user-1",
      sessionId: "session-1",
      now: new Date("2026-07-10T18:00:00.001Z"),
      secret: SECRET,
    }),
    /Licenca offline expirada/,
  );
});
