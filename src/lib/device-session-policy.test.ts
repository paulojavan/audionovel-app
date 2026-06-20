import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDeviceLogin, hasSuspiciousUserAgentChange } from "./device-session-policy";

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

test("revoga todas as sessoes quando terceiro dispositivo tenta entrar", () => {
  const result = evaluateDeviceLogin({
    activeDeviceHashes: ["device-a", "device-b"],
    currentDeviceHash: "device-c",
    maxDevices: 2,
  });

  assert.deepEqual(result, { allowed: false, reason: "DEVICE_LIMIT_EXCEEDED" });
});

test("detecta mudanca suspeita de user-agent na mesma sessao", () => {
  assert.equal(hasSuspiciousUserAgentChange("ua-a", "ua-a"), false);
  assert.equal(hasSuspiciousUserAgentChange("ua-a", "ua-b"), true);
});
