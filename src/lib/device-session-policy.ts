type EvaluateDeviceLoginOptions = {
  activeDeviceHashes: string[];
  currentDeviceHash: string;
  maxDevices: number;
};

export type DeviceSessionCandidate = {
  id: string;
  deviceIdHash: string;
  lastSeenAt: Date | string;
  createdAt: Date | string;
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

function compareSessionRecency(a: DeviceSessionCandidate, b: DeviceSessionCandidate) {
  const lastSeenDifference = new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime();
  if (lastSeenDifference) return lastSeenDifference;
  const createdDifference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (createdDifference) return createdDifference;
  return a.id.localeCompare(b.id);
}

export function selectDeviceToReplace(
  sessions: DeviceSessionCandidate[],
  currentDeviceHash: string,
  maxDevices: number,
) {
  const latestByDevice = new Map<string, DeviceSessionCandidate>();
  for (const session of sessions) {
    const current = latestByDevice.get(session.deviceIdHash);
    if (!current || compareSessionRecency(current, session) < 0) {
      latestByDevice.set(session.deviceIdHash, session);
    }
  }

  if (latestByDevice.has(currentDeviceHash) || latestByDevice.size < maxDevices) {
    return null;
  }

  return [...latestByDevice.values()].sort(compareSessionRecency)[0]?.deviceIdHash ?? null;
}
