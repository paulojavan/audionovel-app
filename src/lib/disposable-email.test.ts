import assert from "node:assert/strict";
import test from "node:test";
import { isDisposableEmailDomain } from "./disposable-email";

test("identifica dominios de email temporario conhecidos", () => {
  assert.equal(isDisposableEmailDomain("mailinator.com"), true);
  assert.equal(isDisposableEmailDomain("sub.mailinator.com"), true);
  assert.equal(isDisposableEmailDomain("10minutemail.com"), true);
});

test("permite dominios comuns que nao sao descartaveis", () => {
  assert.equal(isDisposableEmailDomain("gmail.com"), false);
  assert.equal(isDisposableEmailDomain("outlook.com"), false);
  assert.equal(isDisposableEmailDomain("exemplo.com.br"), false);
});
