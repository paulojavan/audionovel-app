import assert from "node:assert/strict";
import test from "node:test";
import { parseProfileUpdatePayload } from "./profile-validation";

test("normaliza nome e ignora senha vazia na edicao de perfil", () => {
  const parsed = parseProfileUpdatePayload({
    name: "  Novo Nome  ",
    password: "",
    confirmPassword: "",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data, { name: "Novo Nome" });
  }
});

test("aceita nova senha quando confirmacao confere", () => {
  const parsed = parseProfileUpdatePayload({
    name: "Novo Nome",
    password: "senha1234",
    confirmPassword: "senha1234",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data, { name: "Novo Nome", password: "senha1234" });
  }
});

test("rejeita nova senha quando confirmacao nao confere", () => {
  const parsed = parseProfileUpdatePayload({
    name: "Novo Nome",
    password: "senha1234",
    confirmPassword: "diferente123",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error, "A confirmacao de senha nao confere.");
  }
});
