import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { shouldRefreshSessionLastSeen } from "./device-session";
import {
  evaluateDeviceLogin,
  hasSuspiciousUserAgentChange,
  selectDeviceToReplace,
} from "./device-session-policy";

const deviceSessionSource = readFileSync(
  join(process.cwd(), "src", "lib", "device-session.ts"),
  "utf8",
);

test("permite login quando o dispositivo ja esta ativo", () => {
  const result = evaluateDeviceLogin({
    activeDeviceHashes: ["device-a", "device-b"],
    currentDeviceHash: "device-a",
    maxDevices: 2,
  });

  assert.deepEqual(result, { allowed: true, reason: "KNOWN_DEVICE" });
});

test("permite login de novo dispositivo abaixo do limite", () => {
  const result = evaluateDeviceLogin({
    activeDeviceHashes: ["device-a"],
    currentDeviceHash: "device-b",
    maxDevices: 2,
  });

  assert.deepEqual(result, { allowed: true, reason: "NEW_DEVICE_ALLOWED" });
});

test("permite o terceiro dispositivo ativo", () => {
  const result = evaluateDeviceLogin({
    activeDeviceHashes: ["device-a", "device-b"],
    currentDeviceHash: "device-c",
    maxDevices: 3,
  });

  assert.deepEqual(result, { allowed: true, reason: "NEW_DEVICE_ALLOWED" });
});

test("quarto dispositivo seleciona somente o dispositivo menos recente", () => {
  const replacement = selectDeviceToReplace(
    [
      { id: "session-b", deviceIdHash: "device-b", lastSeenAt: "2026-02-01T00:00:00Z", createdAt: "2026-01-02T00:00:00Z" },
      { id: "session-a", deviceIdHash: "device-a", lastSeenAt: "2026-01-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z" },
      { id: "session-c", deviceIdHash: "device-c", lastSeenAt: "2026-03-01T00:00:00Z", createdAt: "2026-01-03T00:00:00Z" },
    ],
    "device-d",
    3,
  );

  assert.equal(replacement, "device-a");
});

test("desempata dispositivo menos recente por criacao e id", () => {
  const sharedLastSeen = "2026-01-01T00:00:00Z";
  const sharedCreatedAt = "2025-12-01T00:00:00Z";

  assert.equal(
    selectDeviceToReplace(
      [
        { id: "session-b", deviceIdHash: "device-b", lastSeenAt: sharedLastSeen, createdAt: sharedCreatedAt },
        { id: "session-a", deviceIdHash: "device-a", lastSeenAt: sharedLastSeen, createdAt: sharedCreatedAt },
        { id: "session-c", deviceIdHash: "device-c", lastSeenAt: sharedLastSeen, createdAt: "2026-01-01T00:00:00Z" },
      ],
      "device-d",
      3,
    ),
    "device-a",
  );
});

test("login conhecido nunca seleciona dispositivo para substituicao", () => {
  assert.equal(
    selectDeviceToReplace(
      [
        { id: "session-a", deviceIdHash: "device-a", lastSeenAt: "2026-01-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z" },
        { id: "session-b", deviceIdHash: "device-b", lastSeenAt: "2026-02-01T00:00:00Z", createdAt: "2026-02-01T00:00:00Z" },
        { id: "session-c", deviceIdHash: "device-c", lastSeenAt: "2026-03-01T00:00:00Z", createdAt: "2026-03-01T00:00:00Z" },
      ],
      "device-b",
      3,
    ),
    null,
  );
});

test("persistencia serializa a substituicao e nao revoga todas as sessoes", () => {
  assert.match(deviceSessionSource, /MAX_ACTIVE_DEVICES\s*=\s*3/);
  assert.match(deviceSessionSource, /prisma\.\$transaction/);
  assert.match(deviceSessionSource, /FOR UPDATE/);
  assert.match(deviceSessionSource, /DEVICE_REPLACED/);

  const createBlock = deviceSessionSource.match(
    /export async function createDeviceSession[\s\S]*?\n}\n\nexport async function validateDeviceSession/,
  )?.[0] ?? "";
  assert.doesNotMatch(createBlock, /revokeAllUserSessions/);
});

test("detecta mudanca suspeita de user-agent na mesma sessao", () => {
  assert.equal(hasSuspiciousUserAgentChange("ua-a", "ua-a"), false);
  assert.equal(hasSuspiciousUserAgentChange("ua-a", "ua-b"), true);
});

test("atualiza lastSeenAt apenas depois da janela minima", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");

  assert.equal(shouldRefreshSessionLastSeen("2026-06-20T11:56:00.000Z", now), false);
  assert.equal(shouldRefreshSessionLastSeen("2026-06-20T11:55:00.000Z", now), true);
});
