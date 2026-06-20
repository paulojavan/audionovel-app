import assert from "node:assert/strict";
import test from "node:test";
import { parsePasswordResetConfirmPayload, parsePasswordResetRequestPayload } from "./password-reset-validation";

test("normaliza email na solicitacao de recuperacao", () => {
  const parsed = parsePasswordResetRequestPayload({ email: "  USER@EXEMPLO.COM " });

  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.email, "user@exemplo.com");
});

test("rejeita solicitacao com email invalido", () => {
  const parsed = parsePasswordResetRequestPayload({ email: "invalido" });

  assert.equal(parsed.success, false);
});

test("aceita token e senha quando confirmacao confere", () => {
  const token = "abc123abc123abc123abc123";
  const parsed = parsePasswordResetConfirmPayload({
    token,
    password: "senha1234",
    confirmPassword: "senha1234",
  });

  assert.deepEqual(parsed, {
    success: true,
    data: { token, password: "senha1234" },
  });
});

test("rejeita redefinicao quando confirmacao nao confere", () => {
  const parsed = parsePasswordResetConfirmPayload({
    token: "abc123abc123abc123abc123",
    password: "senha1234",
    confirmPassword: "outra1234",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) assert.equal(parsed.error, "A confirmacao de senha nao confere.");
});
