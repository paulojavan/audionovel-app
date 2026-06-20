import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password";

test("hashPassword gera hash que nao expoe a senha e verifyPassword valida a senha correta", async () => {
  const hash = await hashPassword("senha-segura-123");

  assert.notEqual(hash, "senha-segura-123");
  assert.equal(hash.startsWith("scrypt$"), true);
  assert.equal(await verifyPassword("senha-segura-123", hash), true);
});

test("verifyPassword rejeita senha incorreta e hashes legados invalidos", async () => {
  const hash = await hashPassword("senha-segura-123");

  assert.equal(await verifyPassword("senha-errada", hash), false);
  assert.equal(await verifyPassword("senha-segura-123", "LEGACY_OAUTH"), false);
});
