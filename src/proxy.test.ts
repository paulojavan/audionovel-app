import assert from "node:assert/strict";
import { test } from "node:test";
import * as proxyModule from "./proxy";

test("identifica chamadas de Server Action em app que nao possui Server Actions", () => {
  const isUnexpectedServerActionRequest = (
    proxyModule as typeof proxyModule & {
      isUnexpectedServerActionRequest?: (headers: Headers) => boolean;
    }
  ).isUnexpectedServerActionRequest;
  assert.equal(typeof isUnexpectedServerActionRequest, "function");
  if (!isUnexpectedServerActionRequest) return;

  assert.equal(isUnexpectedServerActionRequest(new Headers({ "Next-Action": "x" })), true);
  assert.equal(isUnexpectedServerActionRequest(new Headers()), false);
});

test("mantem paginas de conteudo protegidas por autenticacao", () => {
  assert.equal(proxyModule.isPublicPath("/novels"), false);
  assert.equal(proxyModule.isPublicPath("/novels/circle-of-inevitability"), false);
  assert.equal(proxyModule.isPublicPath("/chapters/capitulo-1"), false);
});

test("mantem apenas as paginas anonimas intencionais como publicas", () => {
  assert.equal(proxyModule.isPublicPath("/"), true);
  assert.equal(proxyModule.isPublicPath("/login"), true);
  assert.equal(proxyModule.isPublicPath("/cadastro"), true);
  assert.equal(proxyModule.isPublicPath("/perfil"), false);
});
