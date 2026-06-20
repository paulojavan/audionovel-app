type EvaluateDeviceLoginOptions = {
  activeDeviceHashes: string[];
  currentDeviceHash: string;
  maxDevices: number;
};

export function evaluateDeviceLogin({ activeDeviceHashes, currentDeviceHash, maxDevices }: EvaluateDeviceLoginOptions) {
  const activeDevices = new Set(activeDeviceHashes);

  if (activeDevices.has(currentDeviceHash)) {
    return { allowed: true as const, reason: "KNOWN_DEVICE" as const };
  }

  if (activeDevices.size < maxDevices) {
    return { allowed: true as const, reason: "NEW_DEVICE_ALLOWED" as const };
  }

  return { allowed: false as const, reason: "DEVICE_LIMIT_EXCEEDED" as const };
}

export function hasSuspiciousUserAgentChange(storedUserAgentHash: string | null | undefined, currentUserAgentHash: string) {
  return Boolean(storedUserAgentHash && storedUserAgentHash !== currentUserAgentHash);
}
