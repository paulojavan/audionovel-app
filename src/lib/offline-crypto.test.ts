import assert from "node:assert/strict";
import { test } from "node:test";
import { isOfflineCryptoSupportedEnvironment } from "./offline-crypto";

test("detecta Web Crypto indisponivel quando subtle nao existe", () => {
  const supported = isOfflineCryptoSupportedEnvironment({
    isSecureContext: true,
    crypto: {
      getRandomValues: (array: Uint8Array) => array,
    },
    indexedDB: {},
    localStorage: {},
  });

  assert.equal(supported, false);
});

test("aceita ambiente seguro com Web Crypto e armazenamento offline", () => {
  const supported = isOfflineCryptoSupportedEnvironment({
    isSecureContext: true,
    crypto: {
      subtle: {},
      getRandomValues: (array: Uint8Array) => array,
    },
    indexedDB: {},
    localStorage: {},
  });

  assert.equal(supported, true);
});

test("trata armazenamento bloqueado como offline criptografado indisponivel", () => {
  const supported = isOfflineCryptoSupportedEnvironment({
    isSecureContext: true,
    crypto: {
      subtle: {},
      getRandomValues: (array: Uint8Array) => array,
    },
    indexedDB: {},
    get localStorage() {
      throw new Error("storage blocked");
    },
  });

  assert.equal(supported, false);
});
