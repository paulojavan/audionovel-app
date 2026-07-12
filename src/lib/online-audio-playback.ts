import { AudioDownloadHttpError } from "./audio-cache";

export type OnlineAudioFailureResolution =
  | { kind: "fallback" }
  | { kind: "error"; message: string };

export function resolveOnlineAudioFailure(
  error: unknown,
): OnlineAudioFailureResolution {
  if (!(error instanceof AudioDownloadHttpError)) {
    return { kind: "fallback" };
  }

  if (error.status === 401) {
    return {
      kind: "error",
      message: "Sua sessao expirou. Entre novamente para ouvir.",
    };
  }
  if (error.status === 402) {
    return {
      kind: "error",
      message: "Este capitulo esta disponivel apenas para usuarios Premium.",
    };
  }
  if (error.status === 403) {
    return {
      kind: "error",
      message: "Voce nao tem acesso a este audio.",
    };
  }
  if (error.status === 429) {
    return {
      kind: "error",
      message: "Muitas tentativas de reproducao. Aguarde um momento e tente novamente.",
    };
  }
  if (error.status >= 500) {
    return {
      kind: "error",
      message: "Audio temporariamente indisponivel no servidor. Tente novamente em instantes.",
    };
  }

  return {
    kind: "error",
    message: "Nao foi possivel acessar este audio.",
  };
}
