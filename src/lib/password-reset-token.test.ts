import assert from "node:assert/strict";
import test from "node:test";
import { createPlainResetToken, getPasswordResetExpiry, hashResetToken } from "./password-reset-token";

test("createPlainResetToken gera tokens longos e imprevisiveis", () => {
  const first = createPlainResetToken();
  const second = createPlainResetToken();

  assert.match(first, /^[A-Za-z0-9_-]{40,}$/);
  assert.match(second, /^[A-Za-z0-9_-]{40,}$/);
  assert.notEqual(first, second);
});

test("hashResetToken produz hash estavel sem expor o token original", () => {
  const token = "token-de-teste";
  const hash = hashResetToken(token);

  assert.equal(hashResetToken(token), hash);
  assert.notEqual(hash, token);
  assert.match(hash, /^[A-Za-z0-9_-]+$/);
});

test("getPasswordResetExpiry usa janela curta por padrao", () => {
  const base = new Date("2026-06-19T12:00:00.000Z");

  assert.equal(getPasswordResetExpiry(base).toISOString(), "2026-06-19T13:00:00.000Z");
});
