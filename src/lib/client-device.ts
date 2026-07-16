const DEVICE_ID_STORAGE_KEY = "audio_novel_br_device_id";
const DEVICE_TOKEN_STORAGE_KEY = "audio_novel_br_device_token";

type DeviceTokenStorage = Pick<Storage, "getItem" | "setItem">;

type ClientCrypto = {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

export function createClientDeviceIdValue(cryptoSource: ClientCrypto | undefined = globalThis.crypto) {
  if (cryptoSource?.randomUUID) {
    return cryptoSource.randomUUID();
  }

  if (cryptoSource?.getRandomValues) {
    const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getClientDeviceId() {
  const existingDeviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existingDeviceId) return existingDeviceId;

  const deviceId = createClientDeviceIdValue();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}

export function getClientDeviceName() {
  const navigatorWithUserAgentData = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = navigatorWithUserAgentData.userAgentData?.platform || navigator.platform || "Dispositivo";
  return `${platform} - ${navigator.language || "navegador"}`;
}

export async function ensureClientDeviceToken(
  fetcher: typeof fetch = fetch,
  storage: DeviceTokenStorage | undefined = typeof window === "undefined" ? undefined : window.localStorage,
) {
  let backupToken: string | null = null;
  try {
    backupToken = storage?.getItem(DEVICE_TOKEN_STORAGE_KEY) ?? null;
  } catch {
    backupToken = null;
  }

  const response = await fetcher("/api/auth/device", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ backupToken }),
  });
  const payload = await response.json().catch(() => ({})) as { token?: unknown };
  if (!response.ok || typeof payload.token !== "string" || !payload.token) {
    throw new Error("Nao foi possivel preparar este dispositivo.");
  }

  try {
    storage?.setItem(DEVICE_TOKEN_STORAGE_KEY, payload.token);
  } catch {
    // O cookie assinado continua sendo a fonte primaria quando o storage falha.
  }
  return payload.token;
}
