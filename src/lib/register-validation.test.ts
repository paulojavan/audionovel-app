import assert from "node:assert/strict";
import test from "node:test";
import * as registerValidation from "./register-validation";

const { parseRegisterPayload } = registerValidation;

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

test("traduz conflito concorrente de nome para resposta de cadastro", () => {
  const getRegisterConflictMessage = (
    registerValidation as typeof registerValidation & {
      getRegisterConflictMessage?: (error: unknown) => string | null;
    }
  ).getRegisterConflictMessage;
  assert.equal(typeof getRegisterConflictMessage, "function");
  if (!getRegisterConflictMessage) return;

  assert.equal(
    getRegisterConflictMessage({ code: "P2002", meta: { target: ["name"] } }),
    "Este nome de usuario ja esta em uso.",
  );
  assert.equal(
    getRegisterConflictMessage({ code: "P2002", meta: { target: ["email"] } }),
    "Ja existe uma conta cadastrada com este e-mail.",
  );
  assert.equal(getRegisterConflictMessage(new Error("database unavailable")), null);
});
