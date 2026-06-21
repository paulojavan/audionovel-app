export const OFFLINE_CRYPTO_UNAVAILABLE_MESSAGE =
  "Este navegador precisa de HTTPS e suporte a Web Crypto para salvar e tocar audios offline.";

type OfflineCryptoEnvironment = {
  isSecureContext?: boolean;
  crypto?: {
    subtle?: unknown;
    getRandomValues?: unknown;
  };
  indexedDB?: unknown;
  localStorage?: unknown;
};

export class OfflineCryptoUnavailableError extends Error {
  code = "OFFLINE_CRYPTO_UNAVAILABLE";

  constructor(message = OFFLINE_CRYPTO_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "OfflineCryptoUnavailableError";
  }
}

export function isOfflineCryptoSupportedEnvironment(environment: OfflineCryptoEnvironment) {
  try {
    return (
      environment.isSecureContext !== false &&
      Boolean(environment.crypto?.subtle) &&
      typeof environment.crypto?.getRandomValues === "function" &&
      Boolean(environment.indexedDB) &&
      Boolean(environment.localStorage)
    );
  } catch {
    return false;
  }
}

export function isOfflineCryptoSupported() {
  return isOfflineCryptoSupportedEnvironment(globalThis);
}

export function assertOfflineCryptoSupported() {
  if (!isOfflineCryptoSupported()) throw new OfflineCryptoUnavailableError();
}
