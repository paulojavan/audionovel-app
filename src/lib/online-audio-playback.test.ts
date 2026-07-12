import assert from "node:assert/strict";
import test from "node:test";
import { AudioDownloadHttpError } from "./audio-cache";
import { OfflineCryptoUnavailableError } from "./offline-crypto";
import { resolveOnlineAudioFailure } from "./online-audio-playback";

test("falhas locais e de transferencia permitem streaming direto", () => {
  assert.deepEqual(
    resolveOnlineAudioFailure(new Error("A transferencia terminou antes do esperado.")),
    { kind: "fallback" },
  );
  assert.deepEqual(
    resolveOnlineAudioFailure(new OfflineCryptoUnavailableError()),
    { kind: "fallback" },
  );
});

test("401 informa que a sessao expirou sem tentar streaming anonimo", () => {
  assert.deepEqual(
    resolveOnlineAudioFailure(
      new AudioDownloadHttpError(401, "Autenticacao obrigatoria."),
    ),
    {
      kind: "error",
      message: "Sua sessao expirou. Entre novamente para ouvir.",
    },
  );
});

test("402 informa que o capitulo requer Premium", () => {
  assert.deepEqual(
    resolveOnlineAudioFailure(new AudioDownloadHttpError(402)),
    {
      kind: "error",
      message: "Este capitulo esta disponivel apenas para usuarios Premium.",
    },
  );
});

test("403 informa que o acesso ao audio foi negado", () => {
  assert.deepEqual(
    resolveOnlineAudioFailure(new AudioDownloadHttpError(403)),
    {
      kind: "error",
      message: "Voce nao tem acesso a este audio.",
    },
  );
});

test("429 pede uma pausa antes de nova tentativa", () => {
  assert.deepEqual(
    resolveOnlineAudioFailure(new AudioDownloadHttpError(429)),
    {
      kind: "error",
      message: "Muitas tentativas de reproducao. Aguarde um momento e tente novamente.",
    },
  );
});

test("falha 5xx identifica indisponibilidade do servidor", () => {
  assert.deepEqual(
    resolveOnlineAudioFailure(new AudioDownloadHttpError(502)),
    {
      kind: "error",
      message: "Audio temporariamente indisponivel no servidor. Tente novamente em instantes.",
    },
  );
});
