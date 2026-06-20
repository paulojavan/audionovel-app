import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextAuthSessionCookieValue,
  getNextAuthSessionCookieNames,
  hasNextAuthSessionCookie,
  isNextAuthSessionCookieName,
} from "./session-cookies";

test("identifica cookies de sessao do NextAuth, incluindo chunks", () => {
  assert.equal(isNextAuthSessionCookieName("next-auth.session-token"), true);
  assert.equal(isNextAuthSessionCookieName("next-auth.session-token.0"), true);
  assert.equal(isNextAuthSessionCookieName("__Secure-next-auth.session-token"), true);
  assert.equal(isNextAuthSessionCookieName("__Secure-next-auth.session-token.1"), true);
  assert.equal(isNextAuthSessionCookieName("next-auth.csrf-token"), false);
});

test("detecta quando a requisicao possui cookie de sessao", () => {
  assert.equal(hasNextAuthSessionCookie(["foo", "next-auth.session-token.0"]), true);
  assert.equal(hasNextAuthSessionCookie(["foo", "bar"]), false);
});

test("retorna nomes unicos de cookies de sessao para limpeza", () => {
  assert.deepEqual(getNextAuthSessionCookieNames(["foo", "next-auth.session-token", "next-auth.session-token"]), [
    "next-auth.session-token",
  ]);
});

test("remonta valor de cookie de sessao dividido em chunks", () => {
  assert.equal(
    getNextAuthSessionCookieValue([
      { name: "next-auth.session-token.1", value: "bar" },
      { name: "foo", value: "ignored" },
      { name: "next-auth.session-token.0", value: "foo" },
    ]),
    "foobar",
  );
});
