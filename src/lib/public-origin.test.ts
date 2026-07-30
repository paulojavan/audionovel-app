import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PUBLIC_ORIGIN, getPublicOrigin } from "./public-origin";

test("usa host encaminhado pelo proxy quando disponivel", () => {
  const headers = new Headers({
    "x-forwarded-proto": "https",
    "x-forwarded-host": "audionovelbr.com.br",
    host: "localhost:3000",
  });

  assert.equal(getPublicOrigin({ headers, fallbackOrigin: "http://localhost:3000" }), "https://audionovelbr.com.br");
});

test("ignora NEXTAUTH_URL localhost quando existe host publico encaminhado", () => {
  const headers = new Headers({
    "x-forwarded-proto": "https",
    "x-forwarded-host": "audionovelbr.com.br",
  });

  assert.equal(getPublicOrigin({ headers, envOrigin: "https://localhost:3000" }), "https://audionovelbr.com.br");
});

test("usa env publico quando nao ha host encaminhado", () => {
  assert.equal(getPublicOrigin({ headers: new Headers(), envOrigin: "https://audionovelbr.com.br/" }), "https://audionovelbr.com.br");
});

test("prioriza env publico sobre host encaminhado nao confiavel", () => {
  const headers = new Headers({
    "x-forwarded-proto": "https",
    "x-forwarded-host": "attacker.example",
  });

  assert.equal(
    getPublicOrigin({ headers, envOrigin: "https://audionovelbr.com.br" }),
    "https://audionovelbr.com.br",
  );
});

test("producao usa origem oficial segura quando a configuracao esta ausente", () => {
  const headers = new Headers({
    "x-forwarded-proto": "https",
    "x-forwarded-host": "attacker.example",
  });

  assert.equal(
    getPublicOrigin({
      headers,
      envOrigin: "http://localhost:3000",
      fallbackOrigin: "http://localhost:3000",
      production: true,
    }),
    DEFAULT_PUBLIC_ORIGIN,
  );
});
