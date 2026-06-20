const DEVICE_ID_STORAGE_KEY = "audio_novel_br_device_id";

export function getClientDeviceId() {
  const existingDeviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existingDeviceId) return existingDeviceId;

  const deviceId = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}

export function getClientDeviceName() {
  const navigatorWithUserAgentData = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = navigatorWithUserAgentData.userAgentData?.platform || navigator.platform || "Dispositivo";
  return `${platform} - ${navigator.language || "navegador"}`;
}
