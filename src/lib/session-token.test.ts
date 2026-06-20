import assert from "node:assert/strict";
import test from "node:test";
import { isDecodedSessionTokenUsable } from "./session-token";

test("aceita token decodificado com usuario ativo", () => {
  assert.equal(isDecodedSessionTokenUsable({ id: "user-1", isBlocked: false, sessionInvalid: false }), true);
});

test("rejeita token sem usuario, bloqueado ou com sessao invalida", () => {
  assert.equal(isDecodedSessionTokenUsable(null), false);
  assert.equal(isDecodedSessionTokenUsable({ id: "" }), false);
  assert.equal(isDecodedSessionTokenUsable({ id: "user-1", isBlocked: true }), false);
  assert.equal(isDecodedSessionTokenUsable({ id: "user-1", sessionInvalid: true }), false);
});
