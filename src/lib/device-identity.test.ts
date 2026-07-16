import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeviceToken,
  getDeviceIdFromToken,
  verifyDeviceToken,
} from "./device-identity";

const SECRET = "device-test-secret";

test("token de dispositivo assinado preserva o id e rejeita adulteracao", () => {
  const token = createDeviceToken("device-1", SECRET);

  assert.equal(getDeviceIdFromToken(token, SECRET), "device-1");
  assert.equal(verifyDeviceToken(token, SECRET), true);
  assert.equal(verifyDeviceToken(`${token}x`, SECRET), false);
});

test("token de dispositivo rejeita formato incompleto e id vazio", () => {
  assert.equal(getDeviceIdFromToken("v1.invalido", SECRET), null);
  assert.throws(() => createDeviceToken("", SECRET), /dispositivo/i);
});
