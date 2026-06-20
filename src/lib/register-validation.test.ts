import assert from "node:assert/strict";
import test from "node:test";
import { parseRegisterPayload } from "./register-validation";

test("normaliza nome e email no cadastro", () => {
  const parsed = parseRegisterPayload({
    name: "  Javan  ",
    email: "  TESTE@EXEMPLO.COM  ",
    password: "senha1234",
    confirmPassword: "senha1234",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.name, "Javan");
    assert.equal(parsed.data.email, "teste@exemplo.com");
  }
});

test("rejeita cadastro quando confirmacao de senha nao confere", () => {
  const parsed = parseRegisterPayload({
    name: "Javan",
    email: "teste@exemplo.com",
    password: "senha1234",
    confirmPassword: "senha5678",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error, "A confirmacao de senha nao confere.");
  }
});

test("rejeita cadastro com email temporario", () => {
  const parsed = parseRegisterPayload({
    name: "Javan",
    email: "teste@mailinator.com",
    password: "senha1234",
    confirmPassword: "senha1234",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error, "Emails temporarios nao sao permitidos.");
  }
});
